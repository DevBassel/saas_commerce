import { Test } from '@nestjs/testing';
import { SubscriptionController } from '../../controllers/subscription.controller';
import { SubscriptionService } from '../../services/subscription.service';
import { SubscriptionPlansService } from '../../services/subscription-plans.service';
import { SubscriptionUsageService } from '../../services/subscription-usage.service';
import {
  tenantStorage,
  tenantRefFromContext,
} from '../../../auth/tenant-context';

jest.mock('../../../auth/tenant-context', () => ({
  tenantStorage: {
    run: jest.fn((ctx, fn) => fn()),
    getStore: jest.fn(),
  },
  tenantRefFromContext: jest.fn(),
  getTenantContext: jest.fn(),
}));

const mockSubscriptionService = {
  getByTenantRef: jest.fn(),
  getRefundInfo: jest.fn(),
};

const mockPlansService = {
  findAll: jest.fn(),
};

const mockUsageService = {
  getUsageSummary: jest.fn(),
};

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let subscriptionService: typeof mockSubscriptionService;
  let plansService: typeof mockPlansService;
  let usageService: typeof mockUsageService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: SubscriptionPlansService, useValue: mockPlansService },
        { provide: SubscriptionUsageService, useValue: mockUsageService },
      ],
    }).compile();

    controller = moduleRef.get(SubscriptionController);
    subscriptionService = moduleRef.get(SubscriptionService);
    plansService = moduleRef.get(SubscriptionPlansService);
    usageService = moduleRef.get(SubscriptionUsageService);
    jest.clearAllMocks();
  });

  describe('get', () => {
    beforeEach(() => {
      (tenantRefFromContext as jest.Mock).mockReturnValue({
        schemaName: 'tenant_test',
      });
    });

    it('returns subscription with refund info merged', async () => {
      const subscription = { id: 1, planId: 1, status: 'ACTIVE' };
      const refundInfo = {
        refundEligible: true,
        refundDeadline: '2026-01-08T00:00:00.000Z',
      };
      subscriptionService.getByTenantRef.mockResolvedValue(subscription);
      subscriptionService.getRefundInfo.mockResolvedValue(refundInfo);

      const result = await controller.get();

      expect(subscriptionService.getByTenantRef).toHaveBeenCalled();
      expect(subscriptionService.getRefundInfo).toHaveBeenCalledWith(
        subscription,
      );
      expect(result).toEqual({ ...subscription, ...refundInfo });
    });

    it('returns null when no subscription', async () => {
      subscriptionService.getByTenantRef.mockResolvedValue(null);
      subscriptionService.getRefundInfo.mockResolvedValue({
        refundEligible: false,
        refundDeadline: null,
      });

      const result = await controller.get();

      expect(result).toBeNull();
    });
  });

  describe('listPlans', () => {
    it('delegates to SubscriptionPlansService.findAll with active and public filters', async () => {
      const expected = [{ id: 1, name: 'Free', slug: 'free' }];
      plansService.findAll.mockResolvedValue(expected);

      const result = await controller.listPlans();

      expect(plansService.findAll).toHaveBeenCalledWith({
        active: true,
        isPublic: true,
      });
      expect(result).toEqual(expected);
    });
  });

  describe('getUsage', () => {
    beforeEach(() => {
      (tenantRefFromContext as jest.Mock).mockReturnValue({
        schemaName: 'tenant_test',
      });
    });

    it('delegates to SubscriptionUsageService.getUsageSummary', async () => {
      const expected = { storage: { used: 100, limit: 1000, remaining: 900 } };
      usageService.getUsageSummary.mockResolvedValue(expected);

      const result = await controller.getUsage();

      expect(usageService.getUsageSummary).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });
});
