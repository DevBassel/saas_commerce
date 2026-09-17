import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

  async toggleActiveTenant(id: number) {
    const tenant = await this.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    if (tenant.status === TenantStatus.ACTIVE) {
      await this.tenantRepo.update(id, {
        status: TenantStatus.INACTIVE,
      });
      return 'Tenant deactivated successfully';
    } else {
      await this.tenantRepo.update(id, {
        status: TenantStatus.ACTIVE,
      });
      return 'Tenant activated successfully';
    }
  }
}
