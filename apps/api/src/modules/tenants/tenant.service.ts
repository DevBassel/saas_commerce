import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { buildSchemaName } from './utils/tenant.utils';
import { TenantManagerService } from './services/tenant-manager.service';
import { User } from '../users/entities/user.entity';
import { TenantStatus } from './enums/tenantStatus.enum';
import { ConfigService } from '@nestjs/config';
import { IDB, IENV } from 'src/common/config/env.interface';
import { TenantMigrationService } from './services/tenant-migration.service';
import {
  provisioningStateIndex,
  TenantProvisioningState,
} from './enums/tenant-provisioning-state.enum';
import { assertTenantSchemaName } from 'src/database/data-source-options';

export interface TenantProvisioningIdentity {
  ownerEmail: string;
  ownerName: string;
  ownerPasswordHash: string;
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantManager: TenantManagerService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<IENV>,
    private readonly tenantMigrations: TenantMigrationService,
  ) {}

  findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getSchemaSizes(schemas: string[]): Promise<Map<string, number>> {
    if (schemas.length === 0) return new Map();
    const rows: { schema_name: string; size_bytes: string }[] =
      await this.dataSource.query(
        `SELECT n.nspname AS schema_name,
                COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint AS size_bytes
         FROM pg_namespace n
         LEFT JOIN pg_class c ON c.relnamespace = n.oid
         WHERE n.nspname = ANY($1)
         GROUP BY n.nspname`,
        [schemas],
      );
    return new Map(
      rows.map((row) => [row.schema_name, Number(row.size_bytes)]),
    );
  }

  getSchemaCapacityBytes(): number {
    return this.config.getOrThrow<IDB>('db').tenantDbCapacityBytes;
  }

  async findById(id: number): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findByIdWithOwner(
    id: number,
  ): Promise<Tenant & { owner: User | null }> {
    const tenant = await this.findById(id);
    let owner: User | null = null;
    if (tenant.ownerUserId) {
      const userRepo = await this.tenantManager.getRepository(User, tenant);
      owner = await userRepo.findOne({
        where: { id: tenant.ownerUserId },
        relations: { role: true, permissions: true },
        select: {
          id: true,
          email: true,
          name: true,
          role: { name: true, key: true },
          permissions: { name: true, key: true },
        },
      });
    }
    return Object.assign(tenant, { owner });
  }

  findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepo.findOneBy({ slug });
  }

  findBySchemaName(schemaName: string): Promise<Tenant | null> {
    return this.tenantRepo.findOneBy({ schemaName });
  }

  findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.tenantRepo.findOneBy({ subdomain });
  }

  findByStripeAccountId(stripeAccountId: string): Promise<Tenant | null> {
    return this.tenantRepo.findOneBy({ stripeAccountId });
  }

  async updateStripeAccountState(
    id: number,
    state: {
      stripeAccountId?: string;
      stripeChargesEnabled?: boolean;
      stripePayoutsEnabled?: boolean;
      stripeDetailsSubmitted?: boolean;
    },
  ): Promise<void> {
    await this.tenantRepo.update({ id }, state);
  }

  async updateCurrency(id: number, currency: string): Promise<void> {
    await this.tenantRepo.update({ id }, { currency });
  }

  async updatePaymentControls(
    id: number,
    state: {
      paymentsPaused?: boolean;
      payoutsPaused?: boolean;
      stripePayoutsInterval?: string | null;
    },
  ): Promise<void> {
    await this.tenantRepo.update({ id }, state);
  }

  async create(
    dto: CreateTenantDto,
    provisioning?: TenantProvisioningIdentity,
  ): Promise<Tenant> {
    const schemaName = buildSchemaName(dto.slug);
    const subdomain = dto.subdomain ?? dto.slug;

    const existingSchema = await this.tenantRepo.findOneBy({ schemaName });
    if (existingSchema)
      throw new ConflictException('Schema name already exists');

    if (schemaName.length >= 63) {
      this.logger.warn(
        `Schema name "${schemaName}" is at the 63-char identifier limit; truncated slugs can collide`,
      );
    }

    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create({
        name: dto.name,
        slug: dto.slug,
        schemaName,
        subdomain,
        status: TenantStatus.INACTIVE,
        provisioningState: TenantProvisioningState.PENDING,
        provisioningOwnerEmail: provisioning?.ownerEmail ?? null,
        provisioningOwnerName: provisioning?.ownerName ?? null,
        provisioningOwnerPasswordHash: provisioning?.ownerPasswordHash ?? null,
        storageCapacityBytes: BigInt(
          this.config.getOrThrow<IDB>('db').tenantStorageCapacityBytes,
        ),
      }),
    );
    return tenant;
  }

  async setOwnerUserId(id: number, ownerUserId: number): Promise<void> {
    await this.tenantRepo.update({ id }, { ownerUserId });
  }

  async startProvisioningAttempt(id: number): Promise<Tenant> {
    return this.tenantRepo.manager.transaction(async (manager) => {
      const tenant = await manager.findOne(Tenant, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');

      tenant.provisioningAttempts += 1;
      tenant.provisioningFailedStep = null;
      tenant.provisioningLastError = null;
      tenant.provisioningFailedAt = null;
      return manager.save(Tenant, tenant);
    });
  }

  async advanceProvisioningState(
    id: number,
    target: TenantProvisioningState,
  ): Promise<Tenant> {
    return this.tenantRepo.manager.transaction(async (manager) => {
      const tenant = await manager.findOne(Tenant, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');

      const currentIndex = provisioningStateIndex(tenant.provisioningState);
      const targetIndex = provisioningStateIndex(target);
      if (currentIndex >= targetIndex) return tenant;
      if (targetIndex !== currentIndex + 1) {
        throw new ConflictException(
          `Invalid tenant provisioning transition: ${tenant.provisioningState} -> ${target}`,
        );
      }

      tenant.provisioningState = target;
      tenant.provisioningFailedStep = null;
      tenant.provisioningLastError = null;
      tenant.provisioningFailedAt = null;
      return manager.save(Tenant, tenant);
    });
  }

  async recordProvisioningFailure(
    id: number,
    failedStep: TenantProvisioningState,
    error: unknown,
  ): Promise<void> {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 4000);
    await this.tenantRepo.update(
      { id },
      {
        provisioningFailedStep: failedStep,
        provisioningLastError: message,
        provisioningFailedAt: new Date(),
      },
    );
  }

  async completeProvisioning(id: number): Promise<Tenant> {
    return this.tenantRepo.manager.transaction(async (manager) => {
      const tenant = await manager.findOne(Tenant, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');
      if (
        tenant.provisioningState === TenantProvisioningState.ACTIVE &&
        tenant.status === TenantStatus.ACTIVE
      ) {
        return tenant;
      }
      if (
        tenant.provisioningState !== TenantProvisioningState.OWNER_CREATED ||
        tenant.ownerUserId == null
      ) {
        throw new ConflictException(
          'Tenant cannot be activated before provisioning completes',
        );
      }

      tenant.provisioningState = TenantProvisioningState.ACTIVE;
      tenant.status = TenantStatus.ACTIVE;
      tenant.provisioningOwnerPasswordHash = null;
      tenant.provisioningFailedStep = null;
      tenant.provisioningLastError = null;
      tenant.provisioningFailedAt = null;
      return manager.save(Tenant, tenant);
    });
  }

  async cleanupFailedProvisioning(id: number): Promise<string> {
    const runner = this.dataSource.createQueryRunner();
    let operationError: unknown;
    let schemaName: string | undefined;
    let completed = false;

    try {
      await runner.connect();
      await runner.startTransaction();
      const candidate = await runner.manager.findOne(Tenant, {
        where: { id },
      });
      if (!candidate) throw new NotFoundException('Tenant not found');
      schemaName = assertTenantSchemaName(candidate.schemaName);
      await runner.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`saas-commerce:tenant-provisioning:${schemaName}`],
      );
      await runner.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`saas-commerce:tenant-migrations:${schemaName}`],
      );
      const tenant = await runner.manager.findOne(Tenant, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');
      if (tenant.schemaName !== schemaName) {
        throw new ConflictException('Tenant schema changed during cleanup');
      }
      if (
        tenant.status === TenantStatus.ACTIVE ||
        tenant.provisioningState === TenantProvisioningState.ACTIVE
      ) {
        throw new ConflictException(
          'Active tenant provisioning cannot be cleaned up',
        );
      }
      await this.tenantManager.release({ schemaName });
      await runner.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await runner.manager.delete(Tenant, { id });
      await runner.commitTransaction();
      completed = true;
    } catch (error) {
      operationError = error;
    }

    const cleanupErrors: unknown[] = [];
    try {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
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
            `Tenant provisioning cleanup finalization failed for ${id}`,
          )
        : undefined;
    if (operationError) {
      if (cleanupError) {
        this.logger.error(cleanupError.message, cleanupError.stack);
      }
      throw operationError instanceof Error
        ? operationError
        : new Error('Non-Error tenant provisioning cleanup failure', {
            cause: operationError,
          });
    }
    if (cleanupError) throw cleanupError;
    if (!completed || !schemaName) {
      throw new Error(`Tenant provisioning cleanup produced no result: ${id}`);
    }

    this.logger.warn(
      `Cleaned up failed tenant provisioning ${id} (schema ${schemaName})`,
    );
    return schemaName;
  }

  async activate(id: number): Promise<void> {
    const tenant = await this.findById(id);
    await this.migrateAndActivate(tenant);
  }

  async setStorageCapacity(id: number, capacityBytes: bigint): Promise<void> {
    await this.tenantRepo.update(
      { id },
      { storageCapacityBytes: capacityBytes },
    );
  }

  async toggleActiveTenant(id: number) {
    const tenant = await this.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    if (tenant.status === TenantStatus.ACTIVE) {
      await this.tenantRepo.update(id, {
        status: TenantStatus.INACTIVE,
      });
      await this.tenantManager.release({ schemaName: tenant.schemaName });
      return 'Tenant deactivated successfully';
    } else {
      await this.migrateAndActivate(tenant);
      return 'Tenant activated successfully';
    }
  }

  private async migrateAndActivate(tenant: Tenant): Promise<void> {
    if (tenant.provisioningState !== TenantProvisioningState.ACTIVE) {
      throw new ConflictException(
        'Tenant cannot be activated before provisioning completes',
      );
    }
    await this.tenantMigrations.migrate(tenant.schemaName);
    await this.tenantRepo.update(tenant.id, {
      status: TenantStatus.ACTIVE,
    });
  }
  async adjustStorageUsedBytes(
    schemaName: string,
    deltaBytes: number,
  ): Promise<number> {
    if (!Number.isSafeInteger(deltaBytes) || deltaBytes === 0)
      throw new BadRequestException(
        'deltaBytes must be a non-zero safe integer',
      );

    return this.tenantRepo.manager.transaction(async (manager) => {
      const tenant = await manager.findOne(Tenant, {
        where: { schemaName },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tenant)
        throw new NotFoundException(
          `Tenant with schema "${schemaName}" not found`,
        );

      let nextUsedBytes = BigInt(tenant.storageUsedBytes) + BigInt(deltaBytes);

      if (nextUsedBytes < 0n) {
        this.logger.warn(
          `Storage usage clamped to 0 for schema "${schemaName}" (delta ${deltaBytes})`,
        );
        nextUsedBytes = 0n;
      } else if (nextUsedBytes > BigInt(tenant.storageCapacityBytes)) {
        throw new BadRequestException('Storage capacity exceeded');
      }

      await manager.update(
        Tenant,
        { id: tenant.id },
        { storageUsedBytes: nextUsedBytes },
      );

      return Number(nextUsedBytes);
    });
  }
}
