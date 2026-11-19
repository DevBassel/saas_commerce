import StripePaymentService from '../stripe.payment.service';
import { OrderStatus } from '../../orders/constants/order-status.enum';

const orderPayments = {
  repos: jest.fn(),
  createOrderPaymentIntent: jest.fn(),
  refundOrder: jest.fn(),
  reconcileRefunds: jest.fn(),
};

const subscriptionPayments = {
  createSubscriptionPaymentIntent: jest.fn(),
  cancelSubscriptionWithRefund: jest.fn(),
  cancelOwnSubscription: jest.fn(),
  reconcileRefunds: jest.fn(),
};

const webhooks = {
  webHook: jest.fn(),
};

const connect = {
  getAccountStatus: jest.fn(),
  getPlatformAccountStatus: jest.fn(),
  getBalance: jest.fn(),
  getPlatformBalance: jest.fn(),
  listPayouts: jest.fn(),
  getPayoutSchedule: jest.fn(),
  setPayoutInterval: jest.fn(),
  createConnectedAccount: jest.fn(),
  createOnboardingLink: jest.fn(),
  connectAccount: jest.fn(),
};

const tenants = { findAll: jest.fn() };

describe('StripePaymentService', () => {
  let service: StripePaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripePaymentService(
      orderPayments as never,
      subscriptionPayments as never,
      webhooks as never,
      connect as never,
      tenants as never,
    );
  });

  it('delegates order payment operations', () => {
    const tenantRef = { schemaName: 'tenant_acme' };
    const dto = { orderId: 1 };
    const user = { id: 7 };
    const order = { id: 1 };
    const repositories = { paymentRepo: {}, orderRepo: {} };
    const intent = { clientSecret: 'cs_order' };
    const refund = { refundedAt: new Date() };
    orderPayments.repos.mockReturnValue(repositories);
    orderPayments.createOrderPaymentIntent.mockReturnValue(intent);
    orderPayments.refundOrder.mockReturnValue(refund);

    expect(service.repos(tenantRef)).toBe(repositories);
    expect(service.createOrderPaymentIntent(dto, user as never)).toBe(intent);
    expect(
      service.refundOrder(order as never, OrderStatus.CANCELLED, tenantRef),
    ).toBe(refund);
    expect(orderPayments.repos).toHaveBeenCalledWith(tenantRef);
    expect(orderPayments.createOrderPaymentIntent).toHaveBeenCalledWith(
      dto,
      user,
    );
    expect(orderPayments.refundOrder).toHaveBeenCalledWith(
      order,
      OrderStatus.CANCELLED,
      tenantRef,
    );
  });

  it('delegates subscription payment operations', () => {
    const dto = { planId: 2 };
    const intent = { clientSecret: 'cs_subscription' };
    const canceled = { id: 1, planId: 1 };
    const ownCanceled = { id: 2, planId: 1 };
    subscriptionPayments.createSubscriptionPaymentIntent.mockReturnValue(
      intent,
    );
    subscriptionPayments.cancelSubscriptionWithRefund.mockReturnValue(canceled);
    subscriptionPayments.cancelOwnSubscription.mockReturnValue(ownCanceled);

    expect(service.createSubscriptionPaymentIntent(dto)).toBe(intent);
    expect(service.cancelSubscriptionWithRefund(3)).toBe(canceled);
    expect(service.cancelOwnSubscription(4)).toBe(ownCanceled);
    expect(
      subscriptionPayments.createSubscriptionPaymentIntent,
    ).toHaveBeenCalledWith(dto);
    expect(
      subscriptionPayments.cancelSubscriptionWithRefund,
    ).toHaveBeenCalledWith(3);
    expect(subscriptionPayments.cancelOwnSubscription).toHaveBeenCalledWith(4);
  });

  it('delegates webhook handling', () => {
    const request = { rawBody: Buffer.from('{}') };
    const result = { received: true };
    webhooks.webHook.mockReturnValue(result);

    expect(service.webHook(request as never, 'sig')).toBe(result);
    expect(webhooks.webHook).toHaveBeenCalledWith(request, 'sig');
  });

  it('reconciles platform and every tenant refund queue', async () => {
    subscriptionPayments.reconcileRefunds.mockResolvedValue({
      attempted: 1,
      processed: 1,
      failed: 0,
    });
    tenants.findAll.mockResolvedValue([
      { schemaName: 'tenant_a' },
      { schemaName: 'tenant_b' },
    ]);
    orderPayments.reconcileRefunds
      .mockResolvedValueOnce({ attempted: 2, processed: 1, failed: 0 })
      .mockResolvedValueOnce({ attempted: 1, processed: 0, failed: 1 });

    await expect(service.reconcileRefunds(50)).resolves.toEqual({
      attempted: 4,
      processed: 2,
      failed: 1,
      subscriptions: { attempted: 1, processed: 1, failed: 0 },
      orders: { attempted: 3, processed: 1, failed: 1 },
    });
    expect(subscriptionPayments.reconcileRefunds).toHaveBeenCalledWith(50);
    expect(orderPayments.reconcileRefunds).toHaveBeenNthCalledWith(
      1,
      { schemaName: 'tenant_a' },
      50,
    );
    expect(orderPayments.reconcileRefunds).toHaveBeenNthCalledWith(
      2,
      { schemaName: 'tenant_b' },
      50,
    );
  });

  it('delegates Stripe Connect operations', () => {
    const tenant = { id: 3 };
    const request = { tenant };
    const account = { connected: true };
    const platformAccount = { connected: true, accountId: 'acct_platform' };
    const balance = { available: [], pending: [] };
    const platformBalance = { available: [], pending: [] };
    const payouts = { data: [] };
    const updatedAccount = { id: 'acct_1' };
    const connectedAccount = { id: 'acct_new' };
    const link = { url: 'https://stripe.test/onboard' };
    const connected = { url: link.url };
    connect.getAccountStatus.mockReturnValue(account);
    connect.getPlatformAccountStatus.mockReturnValue(platformAccount);
    connect.getBalance.mockReturnValue(balance);
    connect.getPlatformBalance.mockReturnValue(platformBalance);
    connect.listPayouts.mockReturnValue(payouts);
    connect.getPayoutSchedule.mockReturnValue('weekly');
    connect.setPayoutInterval.mockReturnValue(updatedAccount);
    connect.createConnectedAccount.mockReturnValue(connectedAccount);
    connect.createOnboardingLink.mockReturnValue(link);
    connect.connectAccount.mockReturnValue(connected);

    expect(service.getAccountStatus(tenant as never)).toBe(account);
    expect(service.getPlatformAccountStatus()).toBe(platformAccount);
    expect(service.getBalance('acct_1')).toBe(balance);
    expect(service.getPlatformBalance()).toBe(platformBalance);
    expect(
      service.listPayouts('acct_1', { limit: 10, startingAfter: 'po_1' }),
    ).toBe(payouts);
    expect(service.getPayoutSchedule('acct_1')).toBe('weekly');
    expect(service.setPayoutInterval('acct_1', 'manual')).toBe(updatedAccount);
    expect(
      service.createConnectedAccount('owner@test.dev', 'tenant_acme'),
    ).toBe(connectedAccount);
    expect(
      service.createOnboardingLink(
        'acct_1',
        'https://app.test/return',
        'https://app.test/refresh',
      ),
    ).toBe(link);
    expect(service.connectAccount(request as never)).toBe(connected);

    expect(connect.getAccountStatus).toHaveBeenCalledWith(tenant);
    expect(connect.getPlatformAccountStatus).toHaveBeenCalledWith();
    expect(connect.getBalance).toHaveBeenCalledWith('acct_1');
    expect(connect.getPlatformBalance).toHaveBeenCalledWith();
    expect(connect.listPayouts).toHaveBeenCalledWith('acct_1', {
      limit: 10,
      startingAfter: 'po_1',
    });
    expect(connect.getPayoutSchedule).toHaveBeenCalledWith('acct_1');
    expect(connect.setPayoutInterval).toHaveBeenCalledWith('acct_1', 'manual');
    expect(connect.createConnectedAccount).toHaveBeenCalledWith(
      'owner@test.dev',
      'tenant_acme',
    );
    expect(connect.createOnboardingLink).toHaveBeenCalledWith(
      'acct_1',
      'https://app.test/return',
      'https://app.test/refresh',
    );
    expect(connect.connectAccount).toHaveBeenCalledWith(request);
  });
});
