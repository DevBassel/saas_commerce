import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { TenantManagerService } from '../tenants/tenant-manager.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import { SerializedCategory } from './constants/categories.interface';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255);

export const serializeCategory = (category: Category): SerializedCategory => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description ?? null,
  isActive: category.isActive,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

@Injectable()
export class CategoriesService {
  constructor(private readonly tenantManager: TenantManagerService) {}

  private resolveTenant(tenant?: TenantRef): TenantRef {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context required');
    return target;
  }

  private repo(tenant?: TenantRef): Promise<Repository<Category>> {
    return this.tenantManager.getRepository(
      Category,
      this.resolveTenant(tenant),
    );
  }

  async create(dto: CreateCategoryDto, tenant?: TenantRef) {
    const categoryRepo = await this.repo(tenant);

    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new BadRequestException(
        'name must contain alphanumeric characters',
      );
    }

    const existing = await categoryRepo.findOneBy({ slug });
    if (existing) throw new BadRequestException('slug already exists');

    const category = await categoryRepo.save(
      categoryRepo.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      }),
    );
    return serializeCategory(category);
  }

  async findAll(tenant?: TenantRef) {
    const categoryRepo = await this.repo(tenant);
    const categories = await categoryRepo.find({ order: { name: 'ASC' } });
    return categories.map((category) => serializeCategory(category));
  }

  async findOne(id: number, tenant?: TenantRef) {
    const category = await this.findById(id, tenant);
    if (!category) throw new NotFoundException('Category not found');
    return serializeCategory(category);
  }

  async findById(id: number, tenant?: TenantRef): Promise<Category | null> {
    const categoryRepo = await this.repo(tenant);
    return categoryRepo.findOneBy({ id });
  }

  async update(id: number, dto: UpdateCategoryDto, tenant?: TenantRef) {
    const categoryRepo = await this.repo(tenant);
    const category = await categoryRepo.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found');

    if (dto.slug && dto.slug !== category.slug) {
      const existing = await categoryRepo.findOneBy({ slug: dto.slug });
      if (existing) throw new BadRequestException('slug already exists');
    }

    await categoryRepo.update({ id }, { ...dto });
    return this.findOne(id, tenant);
  }

  async remove(id: number, tenant?: TenantRef) {
    const categoryRepo = await this.repo(tenant);
    const category = await categoryRepo.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found');

    await categoryRepo.delete({ id });
    return { deleted: true };
  }
}
