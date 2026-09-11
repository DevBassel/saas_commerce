import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { buildSchemaName } from './tenant.utils';
import { TenantManagerService } from './tenant-manager.service';
import { User } from '../users/entities/user.entity';
import { TenantStatus } from './enums/tenantStatus.enum';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantManager: TenantManagerService,
  ) {}

  findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
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

  findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.tenantRepo.findOneBy({ subdomain });
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const schemaName = buildSchemaName(dto.slug);
    const subdomain = dto.subdomain ?? dto.slug;
    return this.tenantRepo.save(
      this.tenantRepo.create({
        name: dto.name,
        slug: dto.slug,
        schemaName,
        subdomain,
      }),
    );
  }

  async setOwnerUserId(id: number, ownerUserId: number): Promise<void> {
    await this.tenantRepo.update({ id }, { ownerUserId });
  }
  async deactivate(id: number): Promise<void> {
    await this.tenantRepo.update({ id }, { status: TenantStatus.INACTIVE });
  }
}
