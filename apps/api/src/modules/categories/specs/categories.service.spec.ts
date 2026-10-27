import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories.service';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import { tenantStorage } from '../../auth/tenant-context';

const TENANT = { schemaName: 'tenant_test' };

const buildMocks = () => {
  const categoryRepo = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const tenantManager = {
    getRepository: jest.fn(() => Promise.resolve(categoryRepo)),
  } as unknown as TenantManagerService;

  const cacheMocks = {
    invalidateCategories: jest.fn().mockResolvedValue(undefined),
    invalidateProducts: jest.fn().mockResolvedValue(undefined),
  };

  const service = new CategoriesService(tenantManager, cacheMocks as never);
  return { service, categoryRepo, cacheMocks };
};

describe('CategoriesService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildMocks();
    await expect(service.findAll()).rejects.toThrow(ForbiddenException);
  });

  it('creates a category deriving the slug from the name', async () => {
    const { service, categoryRepo, cacheMocks } = buildMocks();
    categoryRepo.findOneBy.mockResolvedValue(null);
    categoryRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    categoryRepo.save.mockImplementation((data: Record<string, unknown>) => ({
      id: 1,
      ...data,
    }));

    const result = await service.create({ name: 'Home & Kitchen' }, TENANT);

    expect(result).toMatchObject({
      id: 1,
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      isActive: true,
    });
    expect(categoryRepo.findOneBy).toHaveBeenCalledWith({
      slug: 'home-kitchen',
    });
    expect(cacheMocks.invalidateCategories).toHaveBeenCalledWith(TENANT);
    expect(cacheMocks.invalidateProducts).toHaveBeenCalledWith(TENANT);
  });

  it('honors a provided slug and rejects duplicates', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy.mockResolvedValue({ id: 2, slug: 'books' });

    await expect(
      service.create({ name: 'Books', slug: 'books' }, TENANT),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 404 when category missing', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(1, TENANT)).rejects.toThrow(NotFoundException);
  });

  it('rejects a duplicate slug on update', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, slug: 'old' })
      .mockResolvedValueOnce({ id: 2, slug: 'taken' });

    await expect(service.update(1, { slug: 'taken' }, TENANT)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('removes a category', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy.mockResolvedValue({ id: 1 });

    await expect(service.remove(1, TENANT)).resolves.toEqual({
      deleted: true,
    });
    expect(categoryRepo.delete).toHaveBeenCalledWith({ id: 1 });
  });

  it('rejects a name that slugifies to an empty string', async () => {
    const { service, categoryRepo } = buildMocks();

    await expect(service.create({ name: '!!!' }, TENANT)).rejects.toThrow(
      BadRequestException,
    );
    expect(categoryRepo.findOneBy).not.toHaveBeenCalled();
    expect(categoryRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a derived slug that already exists', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy.mockResolvedValue({ id: 2, slug: 'books' });

    await expect(service.create({ name: 'Books' }, TENANT)).rejects.toThrow(
      BadRequestException,
    );
    expect(categoryRepo.save).not.toHaveBeenCalled();
  });

  it('lists categories ordered by name', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.find.mockResolvedValue([]);

    await service.findAll(TENANT);

    expect(categoryRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('updates fields and returns the refreshed category', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, slug: 'old' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, name: 'New', slug: 'new' });

    const result = await service.update(
      1,
      { name: 'New', slug: 'new' },
      TENANT,
    );

    expect(categoryRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      { name: 'New', slug: 'new' },
    );
    expect(result).toMatchObject({ id: 1, name: 'New', slug: 'new' });
  });

  it('does not re-check the slug when it is unchanged', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, slug: 'same' })
      .mockResolvedValueOnce({ id: 1, name: 'Same', slug: 'same' });

    await service.update(1, { name: 'Same', slug: 'same' }, TENANT);

    expect(categoryRepo.findOneBy).toHaveBeenCalledTimes(2);
    expect(categoryRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      { name: 'Same', slug: 'same' },
    );
  });

  it('throws 404 when updating a missing category', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy.mockResolvedValue(null);

    await expect(service.update(1, { name: 'X' }, TENANT)).rejects.toThrow(
      NotFoundException,
    );
    expect(categoryRepo.update).not.toHaveBeenCalled();
  });

  it('throws 404 when removing a missing category', async () => {
    const { service, categoryRepo } = buildMocks();
    categoryRepo.findOneBy.mockResolvedValue(null);

    await expect(service.remove(1, TENANT)).rejects.toThrow(NotFoundException);
    expect(categoryRepo.delete).not.toHaveBeenCalled();
  });

  describe('findStorefrontOptions', () => {
    const optionRow = {
      id: 7,
      name: 'Home',
      slug: 'home',
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('projects active categories down to id and name', async () => {
      const { service, categoryRepo } = buildMocks();
      categoryRepo.find.mockResolvedValue([optionRow]);

      const result = await service.findStorefrontOptions(TENANT);

      expect(result).toEqual([{ id: 7, name: 'Home' }]);
      expect(categoryRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, name: true },
        order: { name: 'ASC', id: 'ASC' },
      });
    });

    it('returns an empty list when the tenant has no active categories', async () => {
      const { service, categoryRepo } = buildMocks();
      categoryRepo.find.mockResolvedValue([]);

      await expect(service.findStorefrontOptions(TENANT)).resolves.toEqual([]);
    });

    it('requires a tenant context and never queries without one', async () => {
      const { service, categoryRepo } = buildMocks();

      await expect(service.findStorefrontOptions()).rejects.toThrow(
        ForbiddenException,
      );
      expect(categoryRepo.find).not.toHaveBeenCalled();
    });

    it('reads each request context from its own tenant repository', async () => {
      const alphaRepo = {
        find: jest.fn().mockResolvedValue([{ id: 1, name: 'Alpha' }]),
      };
      const betaRepo = {
        find: jest.fn().mockResolvedValue([{ id: 1, name: 'Beta' }]),
      };
      const tenantManager = {
        getRepository: jest.fn(
          (_entity: unknown, tenant: { schemaName: string }) =>
            Promise.resolve(
              tenant.schemaName === 'tenant_alpha' ? alphaRepo : betaRepo,
            ),
        ),
      } as unknown as TenantManagerService;
      const service = new CategoriesService(tenantManager, {} as never);

      const [alpha, beta] = await Promise.all([
        tenantStorage.run(
          {
            tenant: {
              id: 1,
              slug: 'alpha',
              schemaName: 'tenant_alpha',
            } as never,
            tenantSchema: 'tenant_alpha',
          },
          () => service.findStorefrontOptions(),
        ),
        tenantStorage.run(
          {
            tenant: { id: 2, slug: 'beta', schemaName: 'tenant_beta' } as never,
            tenantSchema: 'tenant_beta',
          },
          () => service.findStorefrontOptions(),
        ),
      ]);

      expect(alpha).toEqual([{ id: 1, name: 'Alpha' }]);
      expect(beta).toEqual([{ id: 1, name: 'Beta' }]);
      expect(alphaRepo.find).toHaveBeenCalledTimes(1);
      expect(betaRepo.find).toHaveBeenCalledTimes(1);
    });
  });
});
