import { Test } from '@nestjs/testing';
import { PlatformPaymentsController } from '../../payments/platform-payments.controller';
import { PlatformPaymentsService } from '../../payments/platform-payments.service';
import { PauseToggleDto } from '../../payments/dto/pause-toggle.dto';

const mockPlatformPaymentsService = {
  listTenants: jest.fn(),
  getSummary: jest.fn(),
  getOverview: jest.fn(),
  listCharges: jest.fn(),
  listPayouts: jest.fn(),
  setPaymentsPaused: jest.fn(),
  setPayoutsPaused: jest.fn(),
};

describe('PlatformPaymentsController', () => {
  let controller: PlatformPaymentsController;
  let service: typeof mockPlatformPaymentsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformPaymentsController],
      providers: [
        {
          provide: PlatformPaymentsService,
          useValue: mockPlatformPaymentsService,
        },
      ],
    }).compile();

    controller = moduleRef.get(PlatformPaymentsController);
    service = moduleRef.get(PlatformPaymentsService);
    jest.clearAllMocks();
  });

  describe('listTenants', () => {
    it('delegates to PlatformPaymentsService.listTenants', async () => {
      const expected = [{ id: 1, name: 'Tenant 1', stripeAccountId: 'acct_1' }];
      service.listTenants.mockResolvedValue(expected);

      const result = await controller.listTenants();

      expect(service.listTenants).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('getSummary', () => {
    it('delegates to PlatformPaymentsService.getSummary', async () => {
      const expected = {
        totalRevenue: 10000,
        connectedAccounts: 5,
        payoutsPending: 500,
      };
      service.getSummary.mockResolvedValue(expected);

      const result = await controller.getSummary();

      expect(service.getSummary).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('getOverview', () => {
    it('delegates to PlatformPaymentsService.getOverview with tenantId', async () => {
      const expected = {
        tenantId: 1,
        charges: [],
        payouts: [],
        balance: { available: 100, pending: 50 },
      };
      service.getOverview.mockResolvedValue(expected);

      const result = await controller.getOverview(1);

      expect(service.getOverview).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('listCharges', () => {
    it('delegates to PlatformPaymentsService.listCharges with tenantId, page, and limit', async () => {
      const expected = { data: [{ id: 'ch_1' }], total: 1 };
      service.listCharges.mockResolvedValue(expected);

      const result = await controller.listCharges(1, 1, 25);

      expect(service.listCharges).toHaveBeenCalledWith(1, 1, 25);
      expect(result).toEqual(expected);
    });
  });

  describe('listPayouts', () => {
    it('delegates to PlatformPaymentsService.listPayouts with tenantId, limit, and startingAfter', async () => {
      const expected = { data: [{ id: 'po_1' }], hasMore: false };
      service.listPayouts.mockResolvedValue(expected);

      const result = await controller.listPayouts(1, 25, 'po_1');

      expect(service.listPayouts).toHaveBeenCalledWith(1, 25, 'po_1');
      expect(result).toEqual(expected);
    });
  });

  describe('setPaymentsPaused', () => {
    it('delegates to PlatformPaymentsService.setPaymentsPaused with tenantId and dto', async () => {
      const dto: PauseToggleDto = { paused: true };
      const expected = { id: 1, paymentsPaused: true };
      service.setPaymentsPaused.mockResolvedValue(expected);

      const result = await controller.setPaymentsPaused(1, dto);

      expect(service.setPaymentsPaused).toHaveBeenCalledWith(1, true);
      expect(result).toEqual(expected);
    });
  });

  describe('setPayoutsPaused', () => {
    it('delegates to PlatformPaymentsService.setPayoutsPaused with tenantId and dto', async () => {
      const dto: PauseToggleDto = { paused: true };
      const expected = { id: 1, payoutsPaused: true };
      service.setPayoutsPaused.mockResolvedValue(expected);

      const result = await controller.setPayoutsPaused(1, dto);

      expect(service.setPayoutsPaused).toHaveBeenCalledWith(1, true);
      expect(result).toEqual(expected);
    });
  });
});
