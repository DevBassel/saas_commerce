import { ConflictException, NotFoundException } from '@nestjs/common';
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

describe('RbacService CRUD', () => {
  const build = () => {
    const roleRepo = makeRepo();
    const permissionRepo = makeRepo();
    const tenantManager = {
      getRepository: jest.fn((entity: unknown) =>
        Promise.resolve(entity === Role ? roleRepo : permissionRepo),
      ),
    } as unknown as TenantManagerService;
    return {
      svc: new RbacService(tenantManager),
      roleRepo,
      permissionRepo,
    };
  };

  it('lists roles for a tenant', async () => {
    const { svc, roleRepo } = build();
    const roles = [{ id: 1 }];
    roleRepo.find.mockResolvedValue(roles);

    await expect(svc.findAllRoles(TENANT)).resolves.toBe(roles);
    expect(roleRepo.find).toHaveBeenCalledWith();
  });

  it('returns a role by id and 404s when missing', async () => {
    const { svc, roleRepo } = build();
    roleRepo.findOneBy.mockResolvedValue({ id: 7, key: 'custom' });

    await expect(svc.findRoleById(7, TENANT)).resolves.toEqual({
      id: 7,
      key: 'custom',
    });

    roleRepo.findOneBy.mockResolvedValue(null);
    await expect(svc.findRoleById(8, TENANT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns null from findRoleByKey when there is no match', async () => {
    const { svc, roleRepo } = build();
    roleRepo.findOneBy.mockResolvedValue(null);

    await expect(
      svc.findRoleByKey('custom' as RoleKey, TENANT),
    ).resolves.toBeNull();
  });

  it('creates a custom role', async () => {
    const { svc, roleRepo } = build();
    roleRepo.findOneBy.mockResolvedValue(null);

    const created = await svc.createRole(
      { key: 'custom', name: 'Custom' },
      TENANT,
    );

    expect(roleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'custom', name: 'Custom' }),
    );
    expect(created).toEqual(
      expect.objectContaining({ key: 'custom', name: 'Custom' }),
    );
  });

  it('rejects a duplicate non-reserved role key', async () => {
    const { svc, roleRepo } = build();
    roleRepo.findOneBy.mockResolvedValue({ id: 9, key: 'custom' });

    await expect(
      svc.createRole({ key: 'custom', name: 'Custom' }, TENANT),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes a custom role and 404s when missing', async () => {
    const { svc, roleRepo } = build();
    roleRepo.findOneBy.mockResolvedValue({
      id: 5,
      key: 'custom',
      isSystem: false,
    });

    await svc.removeRole(5, TENANT);
    expect(roleRepo.delete).toHaveBeenCalledWith({ id: 5 });

    roleRepo.findOneBy.mockResolvedValue(null);
    await expect(svc.removeRole(6, TENANT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists permissions ordered by key', async () => {
    const { svc, permissionRepo } = build();
    permissionRepo.find.mockResolvedValue([]);

    await svc.findAllPermissions(TENANT);

    expect(permissionRepo.find).toHaveBeenCalledWith({
      order: { key: 'ASC' },
    });
  });

  it('creates a permission and rejects duplicates', async () => {
    const { svc, permissionRepo } = build();
    permissionRepo.findOneBy.mockResolvedValue(null);

    await svc.createPermission(
      { key: 'custom:read', name: 'Read custom' } as never,
      TENANT,
    );
    expect(permissionRepo.save).toHaveBeenCalled();

    permissionRepo.findOneBy.mockResolvedValue({ id: 1 });
    await expect(
      svc.createPermission({ key: 'custom:read' } as never, TENANT),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a permission, guards renames and 404s', async () => {
    const { svc, permissionRepo } = build();
    permissionRepo.findOneBy.mockResolvedValue({
      id: 3,
      key: 'old:key',
      name: 'Old',
    });
    permissionRepo.save.mockImplementation((input: unknown) =>
      Promise.resolve(input),
    );

    const updated = await svc.updatePermission(3, { name: 'New' }, TENANT);
    expect(updated).toEqual(
      expect.objectContaining({ id: 3, name: 'New', key: 'old:key' }),
    );

    permissionRepo.findOneBy.mockImplementation(
      (where: { id?: number; key?: string }) => {
        if (where.id === 3) return Promise.resolve({ id: 3, key: 'old:key' });
        if (where.key === 'taken') return Promise.resolve({ id: 4 });
        return Promise.resolve(null);
      },
    );
    await expect(
      svc.updatePermission(3, { key: 'taken' } as never, TENANT),
    ).rejects.toBeInstanceOf(ConflictException);

    permissionRepo.findOneBy.mockResolvedValue(null);
    await expect(
      svc.updatePermission(99, { name: 'x' }, TENANT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a permission and 404s when missing', async () => {
    const { svc, permissionRepo } = build();
    permissionRepo.findOneBy.mockResolvedValue({ id: 2 });

    await svc.removePermission(2, TENANT);
    expect(permissionRepo.delete).toHaveBeenCalledWith({ id: 2 });

    permissionRepo.findOneBy.mockResolvedValue(null);
    await expect(svc.removePermission(3, TENANT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
