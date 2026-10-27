import { Test } from '@nestjs/testing';
import PlatformSubscriptionPaymentController from '../platform-subscription-payment.controller';
import StripePaymentService from '../stripe.payment.service';

const mockStripePaymentService = {
  cancelSubscriptionWithRefund: jest.fn(),
};

describe('PlatformSubscriptionPaymentController', () => {
  let controller: PlatformSubscriptionPaymentController;
  let stripePaymentService: typeof mockStripePaymentService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformSubscriptionPaymentController],
      providers: [
        { provide: StripePaymentService, useValue: mockStripePaymentService },
      ],
    }).compile();

    controller = moduleRef.get(PlatformSubscriptionPaymentController);
    stripePaymentService = moduleRef.get(StripePaymentService);
    jest.clearAllMocks();
  });

  describe('cancelAndRefund', () => {
    it('delegates to StripePaymentService.cancelSubscriptionWithRefund with id', async () => {
      const expected = {
        refunded: true,
        subscription: { id: 1, status: 'CANCELED' },
      };
      stripePaymentService.cancelSubscriptionWithRefund.mockResolvedValue(
        expected,
      );

      const result = await controller.cancelAndRefund(1);

      expect(
        stripePaymentService.cancelSubscriptionWithRefund,
      ).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });
});
