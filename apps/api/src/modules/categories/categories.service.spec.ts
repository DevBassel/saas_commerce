import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';

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

  const service = new CategoriesService(tenantManager);
  return { service, categoryRepo };
};

describe('CategoriesService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildMocks();
    await expect(service.findAll()).rejects.toThrow(ForbiddenException);
  });

  it('creates a category deriving the slug from the name', async () => {
    const { service, categoryRepo } = buildMocks();
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
});
