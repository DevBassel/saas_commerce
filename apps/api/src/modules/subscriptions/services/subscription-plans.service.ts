import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { isUniqueViolation } from 'src/common/db/unique-retry';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionPlanLimit } from '../entities/subscription-plan-limit.entity';
import { SubscriptionPlanFeature } from '../entities/subscription-plan-feature.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import {
  SubscriptionPlanLimitDto,
  SubscriptionPlanFeatureDto,
} from '../dto/create-subscription-plan.dto';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { ListSubscriptionPlansQueryDto } from '../dto/list-subscription-plans.query.dto';

const PLAN_RELATIONS = { limits: true, features: true } as const;

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionPlanLimit)
    private readonly limitRepo: Repository<SubscriptionPlanLimit>,
    @InjectRepository(SubscriptionPlanFeature)
    private readonly featureRepo: Repository<SubscriptionPlanFeature>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async create(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    this.assertLimits(dto.limits ?? []);
    this.assertFeatures(dto.features ?? []);

    const existing = await this.planRepo.findOneBy({ slug: dto.slug });
    if (existing)
      throw new BadRequestException({
        code: 'PLAN_SLUG_TAKEN',
        message: 'Plan slug already exists',
      });

    let plan: SubscriptionPlan;
    try {
      plan = await this.planRepo.save(
        this.planRepo.create({
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          monthlyPrice: dto.monthlyPrice ?? 0,
          yearlyPrice: dto.yearlyPrice ?? 0,
          currency: dto.currency ?? 'usd',
          active: dto.active ?? true,
          isPublic: dto.isPublic ?? true,
          sortOrder: dto.sortOrder ?? 0,
          trialDays: dto.trialDays ?? 0,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new BadRequestException({
          code: 'PLAN_SLUG_TAKEN',
          message: 'Plan slug already exists',
        });
      throw error;
    }

    await this.replaceLimits(plan.id, dto.limits ?? []);
    await this.replaceFeatures(plan.id, dto.features ?? []);
    return this.findOne(plan.id);
  }

  async findAll(query: ListSubscriptionPlansQueryDto = {}) {
    const where: FindOptionsWhere<SubscriptionPlan> = {};
    if (query.active != null) where.active = query.active;
    if (query.isPublic != null) where.isPublic = query.isPublic;

    return this.planRepo.find({
      where,
      relations: PLAN_RELATIONS,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: PLAN_RELATIONS,
    });
    if (!plan)
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found',
      });
    return plan;
  }

  async findBySlug(slug: string): Promise<SubscriptionPlan | null> {
    return this.planRepo.findOne({
      where: { slug },
      relations: PLAN_RELATIONS,
    });
  }

  async update(
    id: number,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOneBy({ id });
    if (!plan)
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found',
      });

    this.assertLimits(dto.limits ?? []);
    this.assertFeatures(dto.features ?? []);

    if (dto.slug && dto.slug !== plan.slug) {
      const owner = await this.planRepo.findOneBy({ slug: dto.slug });
      if (owner && owner.id !== id)
        throw new BadRequestException({
          code: 'PLAN_SLUG_TAKEN',
          message: 'Plan slug already exists',
        });
    }

    const patch: Partial<SubscriptionPlan> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.monthlyPrice !== undefined) patch.monthlyPrice = dto.monthlyPrice;
    if (dto.yearlyPrice !== undefined) patch.yearlyPrice = dto.yearlyPrice;
    if (dto.currency !== undefined) patch.currency = dto.currency;
    if (dto.active !== undefined) patch.active = dto.active;
    if (dto.isPublic !== undefined) patch.isPublic = dto.isPublic;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.trialDays !== undefined) patch.trialDays = dto.trialDays;

    if (Object.keys(patch).length > 0) {
      try {
        await this.planRepo.update({ id }, patch);
      } catch (error) {
        if (isUniqueViolation(error))
          throw new BadRequestException({
            code: 'PLAN_SLUG_TAKEN',
            message: 'Plan slug already exists',
          });
        throw error;
      }
    }

    if (dto.limits !== undefined) await this.replaceLimits(id, dto.limits);
    if (dto.features !== undefined)
      await this.replaceFeatures(id, dto.features);

    return this.findOne(id);
  }

  /**
   * Deactivates a plan that tenants still reference; hard-deletes an unreferenced
   * plan (limits/features cascade). This keeps `ON DELETE RESTRICT` on
   * `subscriptions.planId` satisfiable while allowing cleanup of unused plans.
   */
  async remove(id: number): Promise<{ deleted?: true; deactivated?: true }> {
    const plan = await this.planRepo.findOneBy({ id });
    if (!plan)
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found',
      });

    const references = await this.subscriptionRepo.count({
      where: { planId: id },
    });
    if (references > 0) {
      await this.planRepo.update({ id }, { active: false });
      return { deactivated: true };
    }

    await this.planRepo.delete({ id });
    return { deleted: true };
  }

  private async replaceLimits(
    planId: number,
    limits: SubscriptionPlanLimitDto[],
  ): Promise<void> {
    await this.limitRepo.delete({ planId });
    if (limits.length === 0) return;
    await this.limitRepo.insert(
      limits.map((limit) =>
        this.limitRepo.create({
          planId,
          key: limit.key,
          value: limit.value ?? null,
          type: limit.type,
        }),
      ),
    );
  }

  private async replaceFeatures(
    planId: number,
    features: SubscriptionPlanFeatureDto[],
  ): Promise<void> {
    await this.featureRepo.delete({ planId });
    if (features.length === 0) return;
    await this.featureRepo.insert(
      features.map((feature) =>
        this.featureRepo.create({
          planId,
          key: feature.key,
          enabled: feature.enabled ?? true,
        }),
      ),
    );
  }

  private assertLimits(limits: SubscriptionPlanLimitDto[]): void {
    const known = new Set<string>(Object.values(SubscriptionLimitKey));
    const seen = new Set<string>();
    for (const limit of limits) {
      if (!known.has(limit.key))
        throw new BadRequestException({
          code: 'INVALID_LIMIT_KEY',
          message: `Unknown limit key: ${String(limit.key)}`,
        });
      if (seen.has(limit.key))
        throw new BadRequestException({
          code: 'DUPLICATE_LIMIT_KEY',
          message: `Duplicate limit key: ${limit.key}`,
        });
      seen.add(limit.key);
      if (
        limit.value != null &&
        (!Number.isInteger(limit.value) || limit.value < 0)
      )
        throw new BadRequestException({
          code: 'INVALID_LIMIT_VALUE',
          message: 'Limit value must be a non-negative integer or null',
        });
    }
  }

  private assertFeatures(features: SubscriptionPlanFeatureDto[]): void {
    const known = new Set<string>(Object.values(SubscriptionFeatureKey));
    const seen = new Set<string>();
    for (const feature of features) {
      if (!known.has(feature.key))
        throw new BadRequestException({
          code: 'INVALID_FEATURE_KEY',
          message: `Unknown feature key: ${String(feature.key)}`,
        });
      if (seen.has(feature.key))
        throw new BadRequestException({
          code: 'DUPLICATE_FEATURE_KEY',
          message: `Duplicate feature key: ${feature.key}`,
        });
      seen.add(feature.key);
    }
  }
}
