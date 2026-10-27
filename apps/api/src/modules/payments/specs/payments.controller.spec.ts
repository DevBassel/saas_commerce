import { Test } from '@nestjs/testing';
import PaymentsController from '../payments.controller';
import StripePaymentService from '../stripe.payment.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { CreateSubDto } from '../dto/create-sub.dto';
import type { Request } from 'express';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { PaymentPermissionKey } from '../constants/payments-permissions.enum';
import { SubscriptionPermissionKey } from '../../subscriptions/constants/subscription-permissions.enum';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';

const mockStripePaymentService = {
  createOrderPaymentIntent: jest.fn(),
  createSubscriptionPaymentIntent: jest.fn(),
  cancelOwnSubscription: jest.fn(),
  webHook: jest.fn(),
  getAccountStatus: jest.fn(),
  connectAccount: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: {
      id: 1,
      email: 'test@test.dev',
      permissions: [
        PaymentPermissionKey.CREATE,
        PaymentPermissionKey.MANAGE,
        SubscriptionPermissionKey.MANAGE,
      ],
    },
    tenant: { id: 1, schemaName: 'tenant_test' },
    ...overrides,
  }) as RequestWithUser;

const makeRawBodyRequest = (body: any, rawBody: Buffer): Request =>
  ({
    body,
    rawBody,
    headers: { 'stripe-signature': 'sig' },
  }) as unknown as Request;

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let stripePaymentService: typeof mockStripePaymentService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: StripePaymentService, useValue: mockStripePaymentService },
      ],
    }).compile();

    controller = moduleRef.get(PaymentsController);
    stripePaymentService = moduleRef.get(StripePaymentService);
    jest.clearAllMocks();
  });

  describe('createOrderPaymentIntent', () => {
    it('delegates to StripePaymentService.createOrderPaymentIntent with dto', async () => {
      const dto: CreatePaymentDto = { orderId: 1 };
      const expected = { clientSecret: 'pi_1_secret' };
      stripePaymentService.createOrderPaymentIntent.mockResolvedValue(expected);

      const result = await controller.createOrderPaymentIntent(dto);

      expect(
        stripePaymentService.createOrderPaymentIntent,
      ).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('createSubscriptionPaymentIntent', () => {
    it('delegates to StripePaymentService.createSubscriptionPaymentIntent with dto', async () => {
      const dto: CreateSubDto = {
        planId: 1,
        billingInterval: BillingInterval.MONTHLY,
      };
      const expected = { clientSecret: 'pi_1_secret' };
      stripePaymentService.createSubscriptionPaymentIntent.mockResolvedValue(
        expected,
      );

      const result = await controller.createSubscriptionPaymentIntent(dto);

      expect(
        stripePaymentService.createSubscriptionPaymentIntent,
      ).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('cancelSubscription', () => {
    it('delegates to StripePaymentService.cancelOwnSubscription with tenant id', async () => {
      const req = makeRequest();
      const expected = {
        refunded: true,
        subscription: { id: 1, status: 'CANCELED' },
      };
      stripePaymentService.cancelOwnSubscription.mockResolvedValue(expected);

      const result = await controller.cancelSubscription(req);

      expect(stripePaymentService.cancelOwnSubscription).toHaveBeenCalledWith(
        1,
      );
      expect(result).toEqual(expected);
    });

    it('throws ForbiddenException when tenant context is missing', async () => {
      const req = makeRequest({ tenant: undefined });

      await expect(async () =>
        controller.cancelSubscription(req),
      ).rejects.toThrow('Tenant context is required');
      expect(stripePaymentService.cancelOwnSubscription).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('delegates to StripePaymentService.webHook with raw request and signature', async () => {
      const req = makeRawBodyRequest({}, Buffer.from('{}'));
      const expected = { received: true };
      stripePaymentService.webHook.mockResolvedValue(expected);

      const result = await controller.handleWebhook(req, 'sig');

      expect(stripePaymentService.webHook).toHaveBeenCalledWith(req, 'sig');
      expect(result).toEqual(expected);
    });
  });

  describe('getAccount', () => {
    it('delegates to StripePaymentService.getAccountStatus with tenant', async () => {
      const req = makeRequest();
      const expected = { connected: true, accountId: 'acct_1' };
      stripePaymentService.getAccountStatus.mockResolvedValue(expected);

      const result = await controller.getAccount(req);

      expect(stripePaymentService.getAccountStatus).toHaveBeenCalledWith(
        req.tenant!,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('connect', () => {
    it('delegates to StripePaymentService.connectAccount with request', async () => {
      const req = makeRequest();
      const expected = {
        accountId: 'acct_1',
        onboardingUrl: 'https://stripe.com/onboard',
      };
      stripePaymentService.connectAccount.mockResolvedValue(expected);

      const result = await controller.connect(req);

      expect(stripePaymentService.connectAccount).toHaveBeenCalledWith(req);
      expect(result).toEqual(expected);
    });
  });
});
