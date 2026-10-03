import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { TenantRef } from 'src/modules/tenants/utils/tenant.utils';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { BillingInterval } from '../constants/billing-interval.enum';
import { SubscriptionStatus } from '../constants/subscription-status.enum';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { AssignSubscriptionDto } from '../dto/assign-subscription.dto';
import {
  FREE_PLAN_SLUG,
  UNLIMITED_STORAGE_BYTES,
} from '../constants/subscription.constants';

const PLAN_RELATIONS = { limits: true, features: true } as const;
const SUBSCRIPTION_RELATIONS = { plan: PLAN_RELATIONS } as const;

const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const addYears = (date: Date, years: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
};

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly tenantService: TenantService,
  ) {}

  getByTenantId(tenantId: number): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { tenantId },
      relations: SUBSCRIPTION_RELATIONS,
    });
  }

  async getByTenantRef(ref: TenantRef): Promise<Subscription | null> {
    const tenant = await this.tenantService.findBySchemaName(ref.schemaName);
    if (!tenant) return null;
    return this.getByTenantId(tenant.id);
  }

  /**
   * Resolves the effective plan for a tenant. When no subscription row exists
   * (for example a tenant created before the seed ran), it falls back to the
   * free plan so enforcement never silently becomes unlimited.
   */
  async getPlanForTenantId(tenantId: number): Promise<{
    plan: SubscriptionPlan | null;
    subscription: Subscription | null;
  }> {
    const subscription = await this.getByTenantId(tenantId);
    if (subscription?.plan) return { plan: subscription.plan, subscription };

    const plan = await this.planRepo.findOne({
      where: { slug: FREE_PLAN_SLUG },
      relations: PLAN_RELATIONS,
    });
    return { plan, subscription };
  }

  async getPlanForTenantRef(ref: TenantRef): Promise<{
    plan: SubscriptionPlan | null;
    subscription: Subscription | null;
  }> {
    const tenant = await this.tenantService.findBySchemaName(ref.schemaName);
    if (!tenant)
      return {
        plan: await this.planRepo.findOne({
          where: { slug: FREE_PLAN_SLUG },
          relations: PLAN_RELATIONS,
        }),
        subscription: null,
      };
    return this.getPlanForTenantId(tenant.id);
  }

  async getLimitById(
    tenantId: number,
    key: SubscriptionLimitKey,
  ): Promise<number | null> {
    const { plan } = await this.getPlanForTenantId(tenantId);
    return this.readLimit(plan, key);
  }

  async getLimit(
    ref: TenantRef,
    key: SubscriptionLimitKey,
  ): Promise<number | null> {
    const { plan } = await this.getPlanForTenantRef(ref);
    return this.readLimit(plan, key);
  }

  async hasFeatureById(
    tenantId: number,
    key: SubscriptionFeatureKey,
  ): Promise<boolean> {
    const { plan } = await this.getPlanForTenantId(tenantId);
    return this.readFeature(plan, key);
  }

  async hasFeature(
    ref: TenantRef,
    key: SubscriptionFeatureKey,
  ): Promise<boolean> {
    const { plan } = await this.getPlanForTenantRef(ref);
    return this.readFeature(plan, key);
  }

  async assignPlan(
    tenantId: number,
    dto: AssignSubscriptionDto,
  ): Promise<Subscription> {
    const plan = await this.planRepo.findOne({
      where: { id: dto.planId },
      relations: PLAN_RELATIONS,
    });
    if (!plan)
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found',
      });
    if (!plan.active)
      throw new BadRequestException({
        code: 'PLAN_INACTIVE',
        message: 'Plan is inactive',
      });

    const existing = await this.subscriptionRepo.findOneBy({ tenantId });
    if (!plan.isPublic && existing?.planId !== plan.id)
      throw new BadRequestException({
        code: 'PLAN_NOT_PUBLIC',
        message: 'Plan is not available for assignment',
      });

    const billingInterval = dto.billingInterval ?? BillingInterval.MONTHLY;
    const now = new Date();
    const periodEnd =
      billingInterval === BillingInterval.YEARLY
        ? addYears(now, 1)
        : addMonths(now, 1);

    const isNewPlan = existing == null || existing.planId !== plan.id;
    const startsTrial = plan.trialDays > 0 && isNewPlan;
    const trialStart = startsTrial ? now : (existing?.trialStart ?? null);
    const trialEnd = startsTrial
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
      : (existing?.trialEnd ?? null);
    const status = startsTrial
      ? SubscriptionStatus.TRIALING
      : SubscriptionStatus.ACTIVE;

    const saved = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        ...(existing ?? {}),
        tenantId,
        planId: plan.id,
        status,
        billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialStart,
        trialEnd,
      }),
    );

    await this.syncStorageCapacity(tenantId, plan);
    return this.getByTenantId(tenantId).then((row) => row ?? saved);
  }

  async updateStatus(
    tenantId: number,
    status: SubscriptionStatus,
  ): Promise<Subscription | null> {
    const existing = await this.subscriptionRepo.findOneBy({ tenantId });
    if (!existing)
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });

    const patch: Partial<Subscription> = { status };
    if (status === SubscriptionStatus.CANCELED) patch.canceledAt = new Date();
    await this.subscriptionRepo.update({ tenantId }, patch);
    return this.getByTenantId(tenantId);
  }

  /** Idempotent: assigns the free plan only when no subscription exists. */
  async ensureFreeSubscription(tenant: Tenant): Promise<Subscription | null> {
    const existing = await this.subscriptionRepo.findOneBy({
      tenantId: tenant.id,
    });
    if (existing) return existing;

    const free = await this.planRepo.findOneBy({ slug: FREE_PLAN_SLUG });
    if (!free) return null;

    return this.assignPlan(tenant.id, { planId: free.id });
  }

  /** Mirrors the plan's STORAGE_BYTES limit into `Tenant.storageCapacityBytes`. */
  async syncStorageCapacity(
    tenantId: number,
    plan?: SubscriptionPlan,
  ): Promise<void> {
    let target: SubscriptionPlan | null | undefined = plan;
    if (!target) {
      const subscription = await this.subscriptionRepo.findOneBy({ tenantId });
      if (!subscription) return;
      target = await this.planRepo.findOne({
        where: { id: subscription.planId },
        relations: { limits: true },
      });
    }

    const storageLimit = (target?.limits ?? []).find(
      (limit) => limit.key === SubscriptionLimitKey.STORAGE_BYTES,
    );
    const capacity =
      storageLimit?.value != null
        ? BigInt(storageLimit.value)
        : UNLIMITED_STORAGE_BYTES;
    await this.tenantService.setStorageCapacity(tenantId, capacity);
  }

  /**
   * Serializes per-tenant entitlement checks by taking a `pessimistic_write`
   * lock on the public subscription row for the duration of `fn`. The manager
   * passed to `fn` is bound to the same public transaction, so callers can write
   * counters (coupon quota) atomically alongside the lock.
   */
  async withTenantLock<T>(
    tenantId: number,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.findOne(Subscription, {
        where: { tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      return fn(manager);
    });
  }

  /**
   * Resolves the tenant id from a tenant ref, then runs `fn` under the public
   * subscription lock. `tenant` is `null` when the schema is unknown (the lock
   * is skipped and the callback still runs).
   */
  async withTenantLockByRef<T>(
    ref: TenantRef,
    fn: (manager: EntityManager, tenant: Tenant | null) => Promise<T>,
  ): Promise<T> {
    const tenant = await this.tenantService.findBySchemaName(ref.schemaName);
    if (!tenant) return fn(this.dataSource.manager, null);
    return this.withTenantLock(tenant.id, (manager) => fn(manager, tenant));
  }

  private readLimit(
    plan: SubscriptionPlan | null,
    key: SubscriptionLimitKey,
  ): number | null {
    const row = plan?.limits?.find((limit) => limit.key === key);
    if (!row || row.value == null) return null;
    return Number(row.value);
  }

  private readFeature(
    plan: SubscriptionPlan | null,
    key: SubscriptionFeatureKey,
  ): boolean {
    return (plan?.features ?? []).some(
      (feature) => feature.key === key && feature.enabled,
    );
  }
}
