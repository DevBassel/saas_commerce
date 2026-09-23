import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { MAX_ADDRESSES } from './constants/address.constants';

const TENANT = { schemaName: 'tenant_test' };
const NOW = new Date('2026-01-01T00:00:00.000Z');

const newAddress = (
  overrides: Partial<CreateAddressDto> = {},
): CreateAddressDto => ({
  recipientName: 'Jane Doe',
  phone: '+1 555 0100',
  line1: '1 Main St',
  city: 'Springfield',
  postalCode: '62701',
  country: 'us',
  ...overrides,
});

const addressEntity = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: 1,
  userId: 7,
  recipientName: 'Jane Doe',
  phone: '+1 555 0100',
  line1: '1 Main St',
  line2: null,
  city: 'Springfield',
  state: null,
  postalCode: '62701',
  country: 'US',
  label: null,
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const buildMocks = () => {
  const addressRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: Record<string, unknown>) => ({
      id: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...data,
    })),
    update: jest.fn(),
    delete: jest.fn(),
    manager: { transaction: jest.fn() },
  };

  const entityManager = {
    getRepository: jest.fn(() => addressRepo),
  };
  addressRepo.manager.transaction = jest.fn(
    (callback: (m: unknown) => unknown) => callback(entityManager),
  );

  const tenantManager = {
    getRepository: jest.fn(() => Promise.resolve(addressRepo)),
  } as unknown as TenantManagerService;

  const service = new AddressesService(tenantManager);

  return { service, addressRepo, entityManager };
};

describe('AddressesService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildMocks();
    await expect(service.findAll(7)).rejects.toThrow(ForbiddenException);
  });

  describe('create', () => {
    it('makes the first address the default and uppercases the country', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.count.mockResolvedValue(0);

      const result = await service.create(7, newAddress(), TENANT);

      expect(addressRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          isDefault: true,
          country: 'US',
        }),
      );
      expect(addressRepo.update).not.toHaveBeenCalled();
      expect(result.isDefault).toBe(true);
    });

    it('does not default a later address unless requested', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.count.mockResolvedValue(1);

      await service.create(7, newAddress(), TENANT);

      expect(addressRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
      expect(addressRepo.update).not.toHaveBeenCalled();
    });

    it('clears the previous default when isDefault is requested', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.count.mockResolvedValue(2);

      await service.create(7, newAddress({ isDefault: true }), TENANT);

      expect(addressRepo.update).toHaveBeenCalledWith(
        { userId: 7, isDefault: true },
        { isDefault: false },
      );
      expect(addressRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true }),
      );
    });

    it('rejects once the address cap is reached', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.count.mockResolvedValue(MAX_ADDRESSES);

      await expect(service.create(7, newAddress(), TENANT)).rejects.toThrow(
        BadRequestException,
      );
      expect(addressRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes to the owner with the default first then oldest', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.find.mockResolvedValue([]);

      await service.findAll(7, TENANT);

      expect(addressRepo.find).toHaveBeenCalledWith({
        where: { userId: 7 },
        order: { isDefault: 'DESC', createdAt: 'ASC', id: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('throws 404 when the address is not the caller own', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(7, 1, TENANT)).rejects.toThrow(
        NotFoundException,
      );
      expect(addressRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 7 },
      });
    });
  });

  describe('update', () => {
    it('changes fields without touching the default flag', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne
        .mockResolvedValueOnce(addressEntity({ isDefault: false }))
        .mockResolvedValueOnce(addressEntity({ city: 'Shelbyville' }));

      const result = await service.update(
        7,
        1,
        { city: 'Shelbyville' },
        TENANT,
      );

      expect(addressRepo.update).toHaveBeenCalledWith(
        { id: 1, userId: 7 },
        { city: 'Shelbyville' },
      );
      expect(result.city).toBe('Shelbyville');
    });

    it('uppercases the country on update', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne
        .mockResolvedValueOnce(addressEntity())
        .mockResolvedValueOnce(addressEntity());

      await service.update(7, 1, { country: 'gb' }, TENANT);

      expect(addressRepo.update).toHaveBeenCalledWith(
        { id: 1, userId: 7 },
        { country: 'GB' },
      );
    });

    it('throws 404 for a foreign address', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne.mockResolvedValue(null);

      await expect(service.update(7, 1, { city: 'X' }, TENANT)).rejects.toThrow(
        NotFoundException,
      );
      expect(addressRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('setDefault', () => {
    it('clears the old default and promotes the chosen address', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne
        .mockResolvedValueOnce(addressEntity({ isDefault: false }))
        .mockResolvedValueOnce(addressEntity({ isDefault: true }));

      const result = await service.setDefault(7, 1, TENANT);

      expect(addressRepo.update).toHaveBeenCalledWith(
        { userId: 7, isDefault: true },
        { isDefault: false },
      );
      expect(addressRepo.update).toHaveBeenCalledWith(
        { id: 1, userId: 7 },
        { isDefault: true },
      );
      expect(result.isDefault).toBe(true);
    });

    it('is a no-op when the address is already the default', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne.mockResolvedValue(addressEntity({ isDefault: true }));

      await service.setDefault(7, 1, TENANT);

      expect(addressRepo.update).not.toHaveBeenCalled();
    });

    it('throws 404 for a foreign address', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne.mockResolvedValue(null);

      await expect(service.setDefault(7, 1, TENANT)).rejects.toThrow(
        NotFoundException,
      );
      expect(addressRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('promotes the oldest remaining address when the default is removed', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne
        .mockResolvedValueOnce(addressEntity({ id: 1, isDefault: true }))
        .mockResolvedValueOnce(addressEntity({ id: 2, isDefault: false }));

      await expect(service.remove(7, 1, TENANT)).resolves.toEqual({
        deleted: true,
      });

      expect(addressRepo.delete).toHaveBeenCalledWith({ id: 1, userId: 7 });
      expect(addressRepo.findOne).toHaveBeenLastCalledWith({
        where: { userId: 7 },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      expect(addressRepo.update).toHaveBeenCalledWith(
        { id: 2, userId: 7 },
        { isDefault: true },
      );
    });

    it('does not promote when a non-default address is removed', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne.mockResolvedValue(
        addressEntity({ isDefault: false }),
      );

      await service.remove(7, 1, TENANT);

      expect(addressRepo.delete).toHaveBeenCalledWith({ id: 1, userId: 7 });
      expect(addressRepo.update).not.toHaveBeenCalled();
    });

    it('throws 404 for a foreign address', async () => {
      const { service, addressRepo } = buildMocks();
      addressRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(7, 1, TENANT)).rejects.toThrow(
        NotFoundException,
      );
      expect(addressRepo.delete).not.toHaveBeenCalled();
    });
  });
});
