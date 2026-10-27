import { Test } from '@nestjs/testing';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';

const mockDashboardService = {
  getStats: jest.fn(),
};

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: typeof mockDashboardService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
      ],
    }).compile();

    controller = moduleRef.get(DashboardController);
    dashboardService = moduleRef.get(DashboardService);
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('delegates to DashboardService.getStats', async () => {
      const expected = {
        orders: {
          total: 10,
          pending: 2,
          processing: 3,
          shipped: 3,
          delivered: 2,
        },
        customers: 5,
        revenue: 1500,
        stripeBalance: { available: 1000, pending: 500 },
      };
      dashboardService.getStats.mockResolvedValue(expected);

      const result = await controller.getStats();

      expect(dashboardService.getStats).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });
});
