import { type DynamicModule } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TenantCacheService } from '../../../common/cache/tenant-cache.service';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import { TenantModule } from '../../tenants/tenant.module';
import PaymentsModule from '../payments.module';
import { OrderPaymentService } from '../services/order-payment.service';
import { StripeConnectService } from '../services/stripe-connect.service';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';
import { StripeClientService } from '../stripe/stripe-client.service';
import StripePaymentService from '../stripe.payment.service';
import { StripeWebhookService } from '../webhooks/stripe-webhook.service';

describe('PaymentsModule dependency injection', () => {
  it('compiles PaymentsModule with mocked application infrastructure', async () => {
    const dataSource = {
      entityMetadatas: [],
      options: { type: 'postgres' },
      getRepository: jest.fn(() => ({})),
    };
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'stripe'
          ? {
              secretKey: 'sk_test_123',
              publishableKey: 'pk_test_123',
              webhookSecret: 'whsec_123',
              applicationFeeBps: 0,
            }
          : {},
      ),
    };
    const infrastructureModule: DynamicModule = {
      global: true,
      module: class TestInfrastructureModule {},
      providers: [
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: ConfigService, useValue: config },
        { provide: TenantCacheService, useValue: {} },
      ],
      exports: [getDataSourceToken(), ConfigService, TenantCacheService],
    };

    const moduleRef = await Test.createTestingModule({
      imports: [infrastructureModule, PaymentsModule],
    })
      .useMocker(() => ({}))
      .compile();

    expect(moduleRef.get(StripePaymentService)).toBeDefined();
    expect(moduleRef.get(StripeClientService)).toBeDefined();
    expect(moduleRef.get(OrderPaymentService)).toBeDefined();
    expect(moduleRef.get(SubscriptionPaymentService)).toBeDefined();
    expect(moduleRef.get(StripeWebhookService)).toBeDefined();
    expect(moduleRef.get(StripeConnectService)).toBeDefined();
  });

  it('imports TenantModule and does not create a local TenantManagerService', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      PaymentsModule,
    ) as unknown[];
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      PaymentsModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      PaymentsModule,
    ) as unknown[];

    expect(imports).toContain(TenantModule);
    expect(providers).not.toContain(TenantManagerService);
    expect(exports).toEqual([StripePaymentService]);
  });
});
