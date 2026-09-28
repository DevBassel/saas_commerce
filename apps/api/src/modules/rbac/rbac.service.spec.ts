import { ConflictException } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { Role } from './entities/role.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';

type MockRepo = {
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
  find: jest.Mock;
};

const TENANT = { schemaName: 'tenant_test' };

const makeRepo = (): MockRepo => ({
  findOneBy: jest.fn(),
  create: jest.fn((input: unknown) => input),
  save: jest.fn((input: unknown) => Promise.resolve(input)),
  delete: jest.fn(),
  find: jest.fn(),
});

const service = (roleRepo: MockRepo): RbacService => {
  const permissionRepo = makeRepo();
  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Role
        ? Promise.resolve(roleRepo)
        : Promise.resolve(permissionRepo),
    ),
  } as unknown as TenantManagerService;
  return new RbacService(tenantManager);
};

describe('RbacService (C1) reserved keys & immutable system roles', () => {
  it('rejects creating a role with a reserved key', async () => {
    const roleRepo = makeRepo();
    await expect(
      service(roleRepo).createRole({ key: 'SUPER_ADMIN', name: 'x' }, TENANT),
    ).rejects.toThrow(ConflictException);
    expect(roleRepo.save).not.toHaveBeenCalled();
  });

  it('rejects the full escalation chain: create puppet then rename to SUPER_ADMIN', async () => {
    const roleRepo = makeRepo();
    roleRepo.findOneBy.mockImplementation(
      (where: { id?: number; key?: string }) => {
        if (where.id === 5)
          return Promise.resolve({ id: 5, key: 'puppet', isSystem: false });
        return Promise.resolve(null);
      },
    );

    const svc = service(roleRepo);
    const created = await svc.createRole(
      { key: 'puppet', name: 'Puppet' },
      TENANT,
    );
    expect(created.key).toBe('puppet');

    await expect(
      svc.updateRole(5, { key: 'SUPER_ADMIN' }, TENANT),
    ).rejects.toThrow(ConflictException);
  });

  it('forbids changing the key of a system role but allows name updates', async () => {
    const roleRepo = makeRepo();
    roleRepo.findOneBy.mockResolvedValue({
      id: 1,
      key: RoleKey.STORE_OWNER,
      name: 'Store Owner',
      isSystem: true,
    });
    const svc = service(roleRepo);

    await expect(svc.updateRole(1, { key: 'newkey' }, TENANT)).rejects.toThrow(
      ConflictException,
    );

    roleRepo.findOneBy.mockResolvedValue({
      id: 1,
      key: RoleKey.STORE_OWNER,
      name: 'Store Owner',
      isSystem: true,
    });
    const updated = await svc.updateRole(1, { name: 'Owner' }, TENANT);
    expect(updated.name).toBe('Owner');
  });

  it('allows renaming a custom role to another non-reserved key', async () => {
    const roleRepo = makeRepo();
    roleRepo.findOneBy.mockImplementation(
      (where: { id?: number; key?: string }) => {
        if (where.id === 5)
          return Promise.resolve({ id: 5, key: 'puppet', isSystem: false });
        return Promise.resolve(null);
      },
    );
    const updated = await service(roleRepo).updateRole(
      5,
      {
        key: 'assistant',
      },
      TENANT,
    );
    expect(updated.key).toBe('assistant');
  });

  it('refuses to delete a system role', async () => {
    const roleRepo = makeRepo();
    roleRepo.findOneBy.mockResolvedValue({
      id: 1,
      key: RoleKey.STORE_OWNER,
      isSystem: true,
    });
    await expect(service(roleRepo).removeRole(1, TENANT)).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses to delete a reserved-key role even before migration sets isSystem', async () => {
    const roleRepo = makeRepo();
    roleRepo.findOneBy.mockResolvedValue({
      id: 2,
      key: RoleKey.CUSTOMER,
      isSystem: false,
    });
    await expect(service(roleRepo).removeRole(2, TENANT)).rejects.toThrow(
      ConflictException,
    );
  });
});
