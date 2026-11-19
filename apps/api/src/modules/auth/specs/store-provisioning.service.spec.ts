import { ConflictException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { DataSource, QueryRunner } from 'typeorm';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantProvisioningState } from '../../tenants/enums/tenant-provisioning-state.enum';
import { TenantStatus } from '../../tenants/enums/tenantStatus.enum';
import { TenantProvisionerService } from '../../tenants/services/tenant-provisioner.service';
import { TenantService } from '../../tenants/tenant.service';
import { SubscriptionService } from '../../subscriptions/services/subscription.service';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { RegisterStoreDto } from '../dto/register-store.dto';
import { StoreProvisioningService } from '../store-provisioning.service';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const compareMock = compare as jest.MockedFunction<typeof compare>;
const hashMock = hash as jest.MockedFunction<typeof hash>;

const dto: RegisterStoreDto = {
  storeName: 'Acme',
  storeSlug: 'acme',
  subdomain: 'acme',
  name: 'Owner',
  email: 'owner@test.dev',
  password: 'password1',
};

const build = () => {
  const events: string[] = [];
  const tenant = {
    id: 3,
    name: dto.storeName,
    slug: dto.storeSlug,
    schemaName: 'tenant_acme',
    subdomain: dto.subdomain,
    status: TenantStatus.INACTIVE,
    provisioningState: TenantProvisioningState.PENDING,
    provisioningOwnerEmail: dto.email,
    provisioningOwnerName: dto.name,
    provisioningOwnerPasswordHash: 'provisioning-hash',
    provisioningAttempts: 0,
    provisioningFailedStep: null,
    provisioningLastError: null,
    provisioningFailedAt: null,
    ownerUserId: null,
  } as Tenant;
  const owner = {
    id: 9,
    name: dto.name,
    email: dto.email,
    password: 'hashed-password',
    role: { key: RoleKey.STORE_OWNER },
  } as User;
  let tenantExists = false;
  let ownerExists = false;

  const query = jest.fn().mockResolvedValue(undefined);
  const release = jest.fn().mockResolvedValue(undefined);
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined),
    query,
    release,
    isReleased: false,
  } as unknown as QueryRunner;
  const dataSource = {
    createQueryRunner: jest.fn(() => runner),
  } as unknown as DataSource;
  const config = {
    getOrThrow: jest.fn(() => ({ rounds: 12 })),
  };

  const tenants = {
    findBySchemaName: jest.fn(() =>
      Promise.resolve(tenantExists ? tenant : null),
    ),
    create: jest.fn(() => {
      events.push('tenant');
      tenantExists = true;
      return Promise.resolve(tenant);
    }),
    startProvisioningAttempt: jest.fn(() => {
      tenant.provisioningAttempts += 1;
      tenant.provisioningFailedStep = null;
      tenant.provisioningLastError = null;
      tenant.provisioningFailedAt = null;
      return Promise.resolve(tenant);
    }),
    advanceProvisioningState: jest.fn(
      (_id: number, state: TenantProvisioningState) => {
        events.push(state);
        tenant.provisioningState = state;
        return Promise.resolve(tenant);
      },
    ),
    setOwnerUserId: jest.fn((_id: number, ownerId: number) => {
      tenant.ownerUserId = ownerId;
      return Promise.resolve();
    }),
    completeProvisioning: jest.fn(() => {
      events.push(TenantProvisioningState.ACTIVE);
      tenant.provisioningState = TenantProvisioningState.ACTIVE;
      tenant.status = TenantStatus.ACTIVE;
      tenant.provisioningOwnerPasswordHash = null;
      return Promise.resolve(tenant);
    }),
    recordProvisioningFailure: jest.fn(
      (_id: number, step: TenantProvisioningState, error: Error) => {
        tenant.provisioningFailedStep = step;
        tenant.provisioningLastError = error.message;
        tenant.provisioningFailedAt = new Date();
        return Promise.resolve();
      },
    ),
    findById: jest.fn(() => Promise.resolve(tenant)),
    cleanupFailedProvisioning: jest.fn().mockResolvedValue('tenant_acme'),
  };

  const provisioner = {
    createSchema: jest.fn(() => {
      events.push('schema');
      return Promise.resolve();
    }),
    migrate: jest.fn(() => {
      events.push('migrate');
      return Promise.resolve({});
    }),
    seed: jest.fn(() => {
      events.push('seed');
      return Promise.resolve({});
    }),
  };
  const subscriptions = {
    ensureFreeSubscription: jest.fn(() => {
      events.push('subscription');
      return Promise.resolve({ id: 5 });
    }),
  };
  const users = {
    findOne: jest.fn(() => Promise.resolve(ownerExists ? owner : null)),
    create: jest.fn(() => {
      events.push('owner');
      ownerExists = true;
      return Promise.resolve(owner);
    }),
  };

  const service = new StoreProvisioningService(
    dataSource,
    config as never,
    tenants as unknown as TenantService,
    provisioner as unknown as TenantProvisionerService,
    subscriptions as unknown as SubscriptionService,
    users as unknown as UsersService,
  );
  return {
    service,
    tenant,
    owner,
    events,
    query,
    release,
    tenants,
    provisioner,
    subscriptions,
    users,
    setTenantExists: (value: boolean) => {
      tenantExists = value;
    },
    setOwnerExists: (value: boolean) => {
      ownerExists = value;
    },
  };
};

describe('StoreProvisioningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    compareMock.mockResolvedValue(true as never);
    hashMock.mockResolvedValue('provisioning-hash' as never);
  });

  it('runs and records every provisioning step before activation', async () => {
    const { service, tenant, events, query } = build();

    const result = await service.provision(dto);

    expect(result.tenant).toBe(tenant);
    expect(result.owner.id).toBe(9);
    expect(events).toEqual([
      'tenant',
      TenantProvisioningState.TENANT_CREATED,
      'schema',
      TenantProvisioningState.SCHEMA_CREATED,
      'migrate',
      TenantProvisioningState.MIGRATED,
      'seed',
      TenantProvisioningState.SEEDED,
      'subscription',
      TenantProvisioningState.SUBSCRIPTION_ASSIGNED,
      'owner',
      TenantProvisioningState.OWNER_CREATED,
      TenantProvisioningState.ACTIVE,
    ]);
    expect(tenant.status).toBe(TenantStatus.ACTIVE);
    expect(tenant.provisioningAttempts).toBe(1);
    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      ['saas-commerce:tenant-provisioning:tenant_acme'],
    );
    expect(query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      ['saas-commerce:tenant-provisioning:tenant_acme'],
    );
  });

  it('records a failed step and resumes from the last completed state', async () => {
    const { service, tenant, provisioner, users } = build();
    provisioner.seed
      .mockRejectedValueOnce(new Error('seed failed'))
      .mockResolvedValueOnce({});

    await expect(service.provision(dto)).rejects.toThrow('seed failed');

    expect(tenant.provisioningState).toBe(TenantProvisioningState.MIGRATED);
    expect(tenant.provisioningFailedStep).toBe(TenantProvisioningState.SEEDED);
    expect(tenant.status).toBe(TenantStatus.INACTIVE);

    await expect(service.retry(dto)).resolves.toMatchObject({ tenant });

    expect(provisioner.createSchema).toHaveBeenCalledTimes(1);
    expect(provisioner.migrate).toHaveBeenCalledTimes(1);
    expect(provisioner.seed).toHaveBeenCalledTimes(2);
    expect(users.create).toHaveBeenCalledTimes(1);
    expect(tenant.provisioningAttempts).toBe(2);
    expect(tenant.provisioningState).toBe(TenantProvisioningState.ACTIVE);
  });

  it('reuses a matching owner when saving the owner checkpoint failed', async () => {
    const { service, tenant, tenants, users } = build();
    tenants.advanceProvisioningState.mockImplementationOnce((_id, state) => {
      tenant.provisioningState = state;
      return Promise.resolve(tenant);
    });
    const originalAdvance =
      tenants.advanceProvisioningState.getMockImplementation();
    tenants.advanceProvisioningState.mockImplementation((_id, state) => {
      if (state === TenantProvisioningState.OWNER_CREATED) {
        return Promise.reject(new Error('checkpoint failed'));
      }
      return originalAdvance!(_id, state);
    });

    await expect(service.provision(dto)).rejects.toThrow('checkpoint failed');
    expect(tenant.ownerUserId).toBe(9);
    expect(tenant.provisioningState).toBe(
      TenantProvisioningState.SUBSCRIPTION_ASSIGNED,
    );

    tenants.advanceProvisioningState.mockImplementation((_id, state) => {
      tenant.provisioningState = state;
      return Promise.resolve(tenant);
    });
    await service.retry(dto);

    expect(users.create).toHaveBeenCalledTimes(1);
    expect(compareMock).toHaveBeenCalledWith(dto.password, 'hashed-password');
    expect(tenant.provisioningState).toBe(TenantProvisioningState.ACTIVE);
  });

  it('rejects retries whose registration identity does not match', async () => {
    const { service, setTenantExists, provisioner } = build();
    setTenantExists(true);

    await expect(
      service.retry({ ...dto, email: 'attacker@test.dev' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(provisioner.createSchema).not.toHaveBeenCalled();
  });

  it('rejects an incomplete retry with the wrong original password', async () => {
    const { service, setTenantExists, provisioner, tenants } = build();
    setTenantExists(true);
    compareMock.mockResolvedValueOnce(false as never);

    await expect(service.retry(dto)).rejects.toThrow(
      'Store provisioning credentials do not match',
    );

    expect(tenants.startProvisioningAttempt).not.toHaveBeenCalled();
    expect(provisioner.createSchema).not.toHaveBeenCalled();
  });

  it('makes completed retries side-effect free after credential validation', async () => {
    const {
      service,
      tenant,
      setTenantExists,
      setOwnerExists,
      provisioner,
      subscriptions,
      users,
    } = build();
    setTenantExists(true);
    setOwnerExists(true);
    tenant.provisioningState = TenantProvisioningState.ACTIVE;
    tenant.status = TenantStatus.ACTIVE;
    tenant.ownerUserId = 9;

    await service.retry(dto);

    expect(provisioner.createSchema).not.toHaveBeenCalled();
    expect(provisioner.migrate).not.toHaveBeenCalled();
    expect(provisioner.seed).not.toHaveBeenCalled();
    expect(subscriptions.ensureFreeSubscription).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
    expect(compareMock).toHaveBeenCalled();
    expect(tenant.provisioningAttempts).toBe(0);
  });

  it('delegates explicit compensation to the atomic tenant cleanup', async () => {
    const { service, tenants, query } = build();

    await service.cleanup(3);

    expect(tenants.cleanupFailedProvisioning).toHaveBeenCalledWith(3);
    expect(query).not.toHaveBeenCalled();
  });
});
