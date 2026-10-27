import { Test } from '@nestjs/testing';
import { PlatformTenantSubscriptionController } from '../../controllers/platform-tenant-subscription.controller';
import { SubscriptionService } from '../../services/subscription.service';
import { SubscriptionUsageService } from '../../services/subscription-usage.service';
import { AssignSubscriptionDto } from '../../dto/assign-subscription.dto';
import { UpdateSubscriptionStatusDto } from '../../dto/update-subscription-status.dto';
import { BillingInterval } from '../../constants/billing-interval.enum';
import { SubscriptionStatus } from '../../constants/subscription-status.enum';

const mockSubscriptionService = {
  getPlanForTenantId: jest.fn(),
  assignPlan: jest.fn(),
  updateStatus: jest.fn(),
};

const mockUsageService = {
  getUsageSummaryByTenantId: jest.fn(),
};

describe('PlatformTenantSubscriptionController', () => {
  let controller: PlatformTenantSubscriptionController;
  let subscriptionService: typeof mockSubscriptionService;
  let usageService: typeof mockUsageService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformTenantSubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: SubscriptionUsageService, useValue: mockUsageService },
      ],
    }).compile();

    controller = moduleRef.get(PlatformTenantSubscriptionController);
    subscriptionService = moduleRef.get(SubscriptionService);
    usageService = moduleRef.get(SubscriptionUsageService);
    jest.clearAllMocks();
  });

  describe('findSubscription', () => {
    it('delegates to SubscriptionService.getPlanForTenantId with id', async () => {
      const expected = {
        subscription: { id: 1, planId: 1 },
        plan: { name: 'Starter' },
      };
      subscriptionService.getPlanForTenantId.mockResolvedValue(expected);

      const result = await controller.findSubscription(1);

      expect(subscriptionService.getPlanForTenantId).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('findUsage', () => {
    it('delegates to SubscriptionUsageService.getUsageSummaryByTenantId with id', async () => {
      const expected = { storage: { used: 100, limit: 1000, remaining: 900 } };
      usageService.getUsageSummaryByTenantId.mockResolvedValue(expected);

      const result = await controller.findUsage(1);

      expect(usageService.getUsageSummaryByTenantId).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('assign', () => {
    it('delegates to SubscriptionService.assignPlan with id and dto', async () => {
      const dto: AssignSubscriptionDto = {
        planId: 2,
        billingInterval: BillingInterval.MONTHLY,
      };
      const expected = { id: 1, planId: 2, status: 'ACTIVE' };
      subscriptionService.assignPlan.mockResolvedValue(expected);

      const result = await controller.assign(1, dto);

      expect(subscriptionService.assignPlan).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('updateStatus', () => {
    it('delegates to SubscriptionService.updateStatus with id and status string', async () => {
      const dto: UpdateSubscriptionStatusDto = {
        status: SubscriptionStatus.CANCELED,
      };
      const expected = { id: 1, status: SubscriptionStatus.CANCELED };
      subscriptionService.updateStatus.mockResolvedValue(expected);

      const result = await controller.updateStatus(1, dto);

      expect(subscriptionService.updateStatus).toHaveBeenCalledWith(
        1,
        SubscriptionStatus.CANCELED,
      );
      expect(result).toEqual(expected);
    });
  });
});
