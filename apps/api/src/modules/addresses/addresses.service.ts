import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { MAX_ADDRESSES } from './constants/address.constants';
import { SerializedAddress } from './constants/addresses.interface';

export const serializeAddress = (address: Address): SerializedAddress => ({
  id: address.id,
  userId: address.userId,
  recipientName: address.recipientName,
  phone: address.phone,
  line1: address.line1,
  line2: address.line2 ?? null,
  city: address.city,
  state: address.state ?? null,
  postalCode: address.postalCode,
  country: address.country,
  label: address.label ?? null,
  isDefault: address.isDefault,
  createdAt: address.createdAt,
  updatedAt: address.updatedAt,
});

@Injectable()
export class AddressesService {
  constructor(private readonly tenantManager: TenantManagerService) {}

  private resolveTenant(tenant?: TenantRef): TenantRef {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context required');
    return target;
  }

  private repo(tenant?: TenantRef): Promise<Repository<Address>> {
    return this.tenantManager.getRepository(
      Address,
      this.resolveTenant(tenant),
    );
  }

  async create(
    userId: number,
    dto: CreateAddressDto,
    tenant?: TenantRef,
  ): Promise<SerializedAddress> {
    const addressRepo = await this.repo(tenant);

    const address = await this.withUniqueRetry(() =>
      addressRepo.manager.transaction(async (manager) => {
        const addresses = manager.getRepository(Address);

        const count = await addresses.count({ where: { userId } });
        if (count >= MAX_ADDRESSES) {
          throw new BadRequestException(
            `Cannot save more than ${MAX_ADDRESSES} addresses`,
          );
        }

        const isDefault = count === 0 || dto.isDefault === true;
        if (isDefault && count > 0) {
          await addresses.update(
            { userId, isDefault: true },
            { isDefault: false },
          );
        }

        return addresses.save(
          addresses.create({
            userId,
            recipientName: dto.recipientName,
            phone: dto.phone,
            line1: dto.line1,
            line2: dto.line2 ?? null,
            city: dto.city,
            state: dto.state ?? null,
            postalCode: dto.postalCode,
            country: dto.country.toUpperCase(),
            label: dto.label ?? null,
            isDefault,
          }),
        );
      }),
    );

    return serializeAddress(address);
  }

  async findAll(
    userId: number,
    tenant?: TenantRef,
  ): Promise<SerializedAddress[]> {
    const addressRepo = await this.repo(tenant);
    const addresses = await addressRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC', id: 'ASC' },
    });
    return addresses.map((address) => serializeAddress(address));
  }

  async findOne(
    userId: number,
    id: number,
    tenant?: TenantRef,
  ): Promise<SerializedAddress> {
    const address = await this.findOwn(userId, id, tenant);
    if (!address) throw new NotFoundException('Address not found');
    return serializeAddress(address);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateAddressDto,
    tenant?: TenantRef,
  ): Promise<SerializedAddress> {
    const addressRepo = await this.repo(tenant);
    const address = await addressRepo.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');

    const patch: Partial<Address> = {};
    if (dto.recipientName !== undefined)
      patch.recipientName = dto.recipientName;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.line1 !== undefined) patch.line1 = dto.line1;
    if (dto.line2 !== undefined) patch.line2 = dto.line2 ?? null;
    if (dto.city !== undefined) patch.city = dto.city;
    if (dto.state !== undefined) patch.state = dto.state ?? null;
    if (dto.postalCode !== undefined) patch.postalCode = dto.postalCode;
    if (dto.country !== undefined) patch.country = dto.country.toUpperCase();
    if (dto.label !== undefined) patch.label = dto.label ?? null;

    if (Object.keys(patch).length > 0) {
      await addressRepo.update({ id, userId }, patch);
    }

    return this.findOne(userId, id, tenant);
  }

  async setDefault(
    userId: number,
    id: number,
    tenant?: TenantRef,
  ): Promise<SerializedAddress> {
    const addressRepo = await this.repo(tenant);
    const target = this.resolveTenant(tenant);

    await this.withUniqueRetry(() =>
      addressRepo.manager.transaction(async (manager) => {
        const addresses = manager.getRepository(Address);
        const address = await addresses.findOne({ where: { id, userId } });
        if (!address) throw new NotFoundException('Address not found');
        if (address.isDefault) return;

        await addresses.update(
          { userId, isDefault: true },
          { isDefault: false },
        );
        await addresses.update({ id, userId }, { isDefault: true });
      }),
    );

    return this.findOne(userId, id, target);
  }

  async remove(
    userId: number,
    id: number,
    tenant?: TenantRef,
  ): Promise<{ deleted: boolean }> {
    const addressRepo = await this.repo(tenant);

    await this.withUniqueRetry(() =>
      addressRepo.manager.transaction(async (manager) => {
        const addresses = manager.getRepository(Address);
        const address = await addresses.findOne({ where: { id, userId } });
        if (!address) throw new NotFoundException('Address not found');

        await addresses.delete({ id, userId });

        if (address.isDefault) {
          const next = await addresses.findOne({
            where: { userId },
            order: { createdAt: 'ASC', id: 'ASC' },
          });
          if (next) {
            await addresses.update(
              { id: next.id, userId },
              { isDefault: true },
            );
          }
        }
      }),
    );

    return { deleted: true };
  }

  private async findOwn(
    userId: number,
    id: number,
    tenant?: TenantRef,
  ): Promise<Address | null> {
    const addressRepo = await this.repo(tenant);
    return addressRepo.findOne({ where: { id, userId } });
  }

  private async withUniqueRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      return operation();
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    const code =
      (error as { code?: string } | null)?.code ??
      (error as { driverError?: { code?: string } } | null)?.driverError?.code;
    return code === '23505';
  }
}
