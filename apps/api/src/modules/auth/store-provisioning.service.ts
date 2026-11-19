import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { DataSource, QueryRunner } from 'typeorm';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { IENV } from '../../common/config/env.interface';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SubscriptionService } from '../subscriptions/services/subscription.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import {
  hasReachedProvisioningState,
  TenantProvisioningState,
} from '../tenants/enums/tenant-provisioning-state.enum';
import { TenantService } from '../tenants/tenant.service';
import { TenantStatus } from '../tenants/enums/tenantStatus.enum';
import { TenantProvisionerService } from '../tenants/services/tenant-provisioner.service';
import { buildSchemaName } from '../tenants/utils/tenant.utils';
import { RegisterStoreDto } from './dto/register-store.dto';

export interface StoreProvisioningResult {
  tenant: Tenant;
  owner: User;
}

@Injectable()
export class StoreProvisioningService {
  private readonly logger = new Logger(StoreProvisioningService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService<IENV>,
    private readonly tenants: TenantService,
    private readonly tenantProvisioner: TenantProvisionerService,
    private readonly subscriptions: SubscriptionService,
    private readonly users: UsersService,
  ) {}

  async provision(dto: RegisterStoreDto): Promise<StoreProvisioningResult> {
    const schemaName = buildSchemaName(dto.storeSlug);
    return this.withProvisioningLock(schemaName, async () => {
      let tenant = await this.resolveTenant(dto, schemaName);
      if (tenant.provisioningState === TenantProvisioningState.ACTIVE) {
        if (tenant.status !== TenantStatus.ACTIVE) {
          throw new ConflictException('Store is registered but inactive');
        }
        const owner = await this.requireExistingOwner(tenant, dto);
        return { tenant, owner };
      }
      tenant = await this.tenants.startProvisioningAttempt(tenant.id);
      let failedStep = TenantProvisioningState.TENANT_CREATED;

      try {
        if (
          !hasReachedProvisioningState(
            tenant.provisioningState,
            TenantProvisioningState.TENANT_CREATED,
          )
        ) {
          tenant = await this.advance(
            tenant,
            TenantProvisioningState.TENANT_CREATED,
          );
        }

        failedStep = TenantProvisioningState.SCHEMA_CREATED;
        if (
          !hasReachedProvisioningState(
            tenant.provisioningState,
            TenantProvisioningState.SCHEMA_CREATED,
          )
        ) {
          await this.tenantProvisioner.createSchema(tenant);
          tenant = await this.advance(
            tenant,
            TenantProvisioningState.SCHEMA_CREATED,
          );
        }

        failedStep = TenantProvisioningState.MIGRATED;
        if (
          !hasReachedProvisioningState(
            tenant.provisioningState,
            TenantProvisioningState.MIGRATED,
          )
        ) {
          await this.tenantProvisioner.migrate(tenant);
          tenant = await this.advance(tenant, TenantProvisioningState.MIGRATED);
        }

        failedStep = TenantProvisioningState.SEEDED;
        if (
          !hasReachedProvisioningState(
            tenant.provisioningState,
            TenantProvisioningState.SEEDED,
          )
        ) {
          await this.tenantProvisioner.seed(tenant);
          tenant = await this.advance(tenant, TenantProvisioningState.SEEDED);
        }

        failedStep = TenantProvisioningState.SUBSCRIPTION_ASSIGNED;
        if (
          !hasReachedProvisioningState(
            tenant.provisioningState,
            TenantProvisioningState.SUBSCRIPTION_ASSIGNED,
          )
        ) {
          const subscription =
            await this.subscriptions.ensureFreeSubscription(tenant);
          if (!subscription) {
            throw new Error('Free subscription plan is not seeded');
          }
          tenant = await this.advance(
            tenant,
            TenantProvisioningState.SUBSCRIPTION_ASSIGNED,
          );
        }

        failedStep = TenantProvisioningState.OWNER_CREATED;
        let owner: User;
        if (
          !hasReachedProvisioningState(
            tenant.provisioningState,
            TenantProvisioningState.OWNER_CREATED,
          )
        ) {
          owner = await this.ensureOwner(tenant, dto);
          tenant = await this.advance(
            tenant,
            TenantProvisioningState.OWNER_CREATED,
          );
        } else {
          owner = await this.requireExistingOwner(tenant, dto);
        }

        failedStep = TenantProvisioningState.ACTIVE;
        if (
          !hasReachedProvisioningState(
            tenant.provisioningState,
            TenantProvisioningState.ACTIVE,
          )
        ) {
          tenant = await this.tenants.completeProvisioning(tenant.id);
          this.logTransition(tenant, TenantProvisioningState.ACTIVE);
        }

        this.logger.log(
          `Tenant provisioning completed tenantId=${tenant.id} schema=${tenant.schemaName} attempts=${tenant.provisioningAttempts}`,
        );
        return { tenant, owner };
      } catch (error) {
        await this.recordFailure(tenant, failedStep, error);
        throw error;
      }
    });
  }

  retry(dto: RegisterStoreDto): Promise<StoreProvisioningResult> {
    return this.provision(dto);
  }

  async cleanup(tenantId: number): Promise<void> {
    const schemaName = await this.tenants.cleanupFailedProvisioning(tenantId);
    this.logger.warn(
      `Tenant provisioning compensation completed tenantId=${tenantId} schema=${schemaName}`,
    );
  }

  private async resolveTenant(
    dto: RegisterStoreDto,
    schemaName: string,
  ): Promise<Tenant> {
    const existing = await this.tenants.findBySchemaName(schemaName);
    if (!existing) {
      const passwordHash = await hash(
        dto.password,
        this.config.getOrThrow<IENV['bcrypt']>('bcrypt').rounds,
      );
      return this.tenants.create(
        {
          name: dto.storeName,
          slug: dto.storeSlug,
          subdomain: dto.subdomain,
        },
        {
          ownerEmail: dto.email,
          ownerName: dto.name,
          ownerPasswordHash: passwordHash,
        },
      );
    }

    const subdomain = dto.subdomain ?? dto.storeSlug;
    if (
      existing.name !== dto.storeName ||
      existing.slug !== dto.storeSlug ||
      existing.subdomain !== subdomain ||
      existing.provisioningOwnerEmail !== dto.email ||
      existing.provisioningOwnerName !== dto.name
    ) {
      throw new ConflictException(
        'Store registration does not match the existing provisioning request',
      );
    }
    if (existing.provisioningState !== TenantProvisioningState.ACTIVE) {
      if (!existing.provisioningOwnerPasswordHash) {
        throw new ConflictException({
          code: 'TENANT_PROVISIONING_REQUIRES_CLEANUP',
          message:
            'Legacy incomplete tenant requires explicit cleanup before retry',
        });
      }
      if (
        !(await compare(dto.password, existing.provisioningOwnerPasswordHash))
      ) {
        throw new UnauthorizedException(
          'Store provisioning credentials do not match',
        );
      }
    }
    return existing;
  }

  private async ensureOwner(
    tenant: Tenant,
    dto: RegisterStoreDto,
  ): Promise<User> {
    const existing = tenant.ownerUserId
      ? await this.users.findOne(
          { id: tenant.ownerUserId },
          { withRole: true },
          tenant,
        )
      : await this.users.findOne(
          { email: dto.email },
          { withRole: true },
          tenant,
        );

    let owner = existing;
    if (owner) {
      await this.assertOwnerCredentials(owner, dto);
    } else {
      owner = await this.users.create(
        { name: dto.name, email: dto.email, password: dto.password },
        RoleKey.STORE_OWNER,
        tenant,
      );
    }

    if (tenant.ownerUserId !== owner.id) {
      await this.tenants.setOwnerUserId(tenant.id, owner.id);
      tenant.ownerUserId = owner.id;
    }

    return (
      (await this.users.findOne(
        { id: owner.id },
        { withRole: true },
        tenant,
      )) ?? owner
    );
  }

  private async requireExistingOwner(
    tenant: Tenant,
    dto: RegisterStoreDto,
  ): Promise<User> {
    if (tenant.ownerUserId == null) {
      throw new ConflictException('Provisioned tenant owner is missing');
    }
    const owner = await this.users.findOne(
      { id: tenant.ownerUserId },
      { withRole: true },
      tenant,
    );
    if (!owner)
      throw new ConflictException('Provisioned tenant owner is missing');
    await this.assertOwnerCredentials(owner, dto);
    return owner;
  }

  private async assertOwnerCredentials(
    owner: User,
    dto: RegisterStoreDto,
  ): Promise<void> {
    if (
      owner.email !== dto.email ||
      owner.role?.key !== RoleKey.STORE_OWNER ||
      !(await compare(dto.password, owner.password))
    ) {
      throw new UnauthorizedException(
        'Store provisioning credentials do not match',
      );
    }
  }

  private async advance(
    tenant: Tenant,
    state: TenantProvisioningState,
  ): Promise<Tenant> {
    const updated = await this.tenants.advanceProvisioningState(
      tenant.id,
      state,
    );
    this.logTransition(updated, state);
    return updated;
  }

  private logTransition(tenant: Tenant, state: TenantProvisioningState): void {
    this.logger.log(
      `Tenant provisioning transition tenantId=${tenant.id} schema=${tenant.schemaName} state=${state}`,
    );
  }

  private async recordFailure(
    tenant: Tenant,
    failedStep: TenantProvisioningState,
    error: unknown,
  ): Promise<void> {
    this.logger.error(
      `Tenant provisioning failed tenantId=${tenant.id} schema=${tenant.schemaName} step=${failedStep}`,
      error instanceof Error ? error.stack : String(error),
    );
    try {
      await this.tenants.recordProvisioningFailure(
        tenant.id,
        failedStep,
        error,
      );
    } catch (recordError) {
      this.logger.error(
        `Failed to record tenant provisioning failure tenantId=${tenant.id} step=${failedStep}`,
        recordError instanceof Error ? recordError.stack : String(recordError),
      );
    }
  }

  private async withProvisioningLock<T>(
    schemaName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    const lockName = `saas-commerce:tenant-provisioning:${schemaName}`;
    let locked = false;
    let completed = false;
    let result: T | undefined;
    let operationError: unknown;

    try {
      await runner.connect();
      await this.acquireLock(runner, lockName);
      locked = true;
      result = await operation();
      completed = true;
    } catch (error) {
      operationError = error;
    }

    const cleanupErrors: unknown[] = [];
    try {
      if (locked) await this.releaseLock(runner, lockName);
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      if (!runner.isReleased) await runner.release();
    } catch (error) {
      cleanupErrors.push(error);
    }

    const cleanupError =
      cleanupErrors.length > 0
        ? new AggregateError(
            cleanupErrors,
            `Tenant provisioning lock cleanup failed for ${schemaName}`,
          )
        : undefined;
    if (operationError) {
      if (cleanupError) {
        this.logger.error(cleanupError.message, cleanupError.stack);
      }
      throw operationError instanceof Error
        ? operationError
        : new Error('Non-Error tenant provisioning failure', {
            cause: operationError,
          });
    }
    if (cleanupError) throw cleanupError;
    if (!completed) {
      throw new Error(`Tenant provisioning produced no result: ${schemaName}`);
    }
    return result as T;
  }

  private async acquireLock(
    runner: QueryRunner,
    lockName: string,
  ): Promise<void> {
    await runner.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
      lockName,
    ]);
  }

  private async releaseLock(
    runner: QueryRunner,
    lockName: string,
  ): Promise<void> {
    await runner.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
      lockName,
    ]);
  }
}
