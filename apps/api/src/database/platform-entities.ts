import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { CurrencyChangeRequest } from '../modules/currency-requests/entities/currency-change-request.entity';
import { StripeWebhookEvent } from '../modules/payments/entities/stripe-webhook-event.entity';
import { SubscriptionPayment } from '../modules/payments/entities/subscription-payment.entity';
import { Subscription } from '../modules/payments/entities/subscription.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { Role } from '../modules/rbac/entities/role.entity';
import { SubscriptionPlanFeature } from '../modules/subscriptions/entities/subscription-plan-feature.entity';
import { SubscriptionPlanLimit } from '../modules/subscriptions/entities/subscription-plan-limit.entity';
import { SubscriptionPlan } from '../modules/subscriptions/entities/subscription-plan.entity';
import { TenantUsageCounter } from '../modules/subscriptions/entities/tenant-usage-counter.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { User } from '../modules/users/entities/user.entity';

export const PLATFORM_ENTITIES: PostgresConnectionOptions['entities'] = [
  Tenant,
  User,
  Role,
  Permission,
  CurrencyChangeRequest,
  SubscriptionPlan,
  SubscriptionPlanLimit,
  SubscriptionPlanFeature,
  Subscription,
  SubscriptionPayment,
  TenantUsageCounter,
  StripeWebhookEvent,
];
