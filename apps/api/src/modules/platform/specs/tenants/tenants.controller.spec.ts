import { Test } from '@nestjs/testing';
import { PlatformTenantsController } from '../../tenants/tenants.controller';
import { PlatformTenantsService } from '../../tenants/tenants.service';

const mockPlatformTenantsService = {
  listTenants: jest.fn(),
  getTenant: jest.fn(),
  toggleActiveTenant: jest.fn(),
};

describe('PlatformTenantsController', () => {
  let controller: PlatformTenantsController;
  let service: typeof mockPlatformTenantsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformTenantsController],
      providers: [
        {
          provide: PlatformTenantsService,
          useValue: mockPlatformTenantsService,
        },
      ],
    }).compile();

    controller = moduleRef.get(PlatformTenantsController);
    service = moduleRef.get(PlatformTenantsService);
    jest.clearAllMocks();
  });

  describe('listTenants', () => {
    it('delegates to PlatformTenantsService.listTenants', async () => {
      const expected = [{ id: 1, name: 'Tenant 1', slug: 'tenant-1' }];
      service.listTenants.mockResolvedValue(expected);

      const result = await controller.listTenants();

      expect(service.listTenants).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('getTenant', () => {
    it('delegates to PlatformTenantsService.getTenant with id', async () => {
      const expected = {
        id: 1,
        name: 'Tenant 1',
        slug: 'tenant-1',
        owner: { id: 1, email: 'owner@test.dev' },
      };
      service.getTenant.mockResolvedValue(expected);

      const result = await controller.getTenant(1);

      expect(service.getTenant).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('toggleActiveTenant', () => {
    it('delegates to PlatformTenantsService.toggleActiveTenant with id', async () => {
      const expected = { id: 1, name: 'Tenant 1', status: 'inactive' };
      service.toggleActiveTenant.mockResolvedValue(expected);

      const result = await controller.toggleActiveTenant(1);

      expect(service.toggleActiveTenant).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });
});
