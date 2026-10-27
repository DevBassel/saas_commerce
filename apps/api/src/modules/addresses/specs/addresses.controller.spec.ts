import { Test } from '@nestjs/testing';
import { AddressesController } from '../addresses.controller';
import { AddressesService } from '../addresses.service';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { AddressPermissionKey } from '../constants/address-permissions.enum';

const mockAddressesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  setDefault: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: {
      id: 1,
      email: 'test@test.dev',
      permissions: [
        AddressPermissionKey.READ,
        AddressPermissionKey.CREATE,
        AddressPermissionKey.UPDATE,
        AddressPermissionKey.DELETE,
      ],
    },
    ...overrides,
  }) as RequestWithUser;

describe('AddressesController', () => {
  let controller: AddressesController;
  let addressesService: typeof mockAddressesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [
        { provide: AddressesService, useValue: mockAddressesService },
      ],
    }).compile();

    controller = moduleRef.get(AddressesController);
    addressesService = moduleRef.get(AddressesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to AddressesService.findAll with user id', async () => {
      const req = makeRequest();
      const expected = [{ id: 1, userId: 1, line1: '1 Main St' }];
      addressesService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(req);

      expect(addressesService.findAll).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('delegates to AddressesService.findOne with user id and address id', async () => {
      const req = makeRequest();
      const expected = { id: 2, userId: 1, line1: '2 Second Ave' };
      addressesService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(req, 2);

      expect(addressesService.findOne).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to AddressesService.create with user id and dto', async () => {
      const req = makeRequest();
      const dto: CreateAddressDto = {
        recipientName: 'John Doe',
        phone: '+15551234',
        line1: '3 Third St',
        city: 'City',
        state: 'ST',
        postalCode: '12345',
        country: 'US',
      };
      const expected = { id: 3, userId: 1, ...dto };
      addressesService.create.mockResolvedValue(expected);

      const result = await controller.create(req, dto);

      expect(addressesService.create).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('setDefault', () => {
    it('delegates to AddressesService.setDefault with user id and address id', async () => {
      const req = makeRequest();
      const expected = { id: 2, userId: 1, isDefault: true };
      addressesService.setDefault.mockResolvedValue(expected);

      const result = await controller.setDefault(req, 2);

      expect(addressesService.setDefault).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to AddressesService.update with user id, address id, and dto', async () => {
      const req = makeRequest();
      const dto: UpdateAddressDto = { line1: 'Updated St', city: 'New City' };
      const expected = {
        id: 2,
        userId: 1,
        line1: 'Updated St',
        city: 'New City',
      };
      addressesService.update.mockResolvedValue(expected);

      const result = await controller.update(req, 2, dto);

      expect(addressesService.update).toHaveBeenCalledWith(1, 2, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('delegates to AddressesService.remove with user id and address id', async () => {
      const req = makeRequest();
      const expected = { deleted: true };
      addressesService.remove.mockResolvedValue(expected);

      const result = await controller.remove(req, 2);

      expect(addressesService.remove).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(expected);
    });
  });
});
