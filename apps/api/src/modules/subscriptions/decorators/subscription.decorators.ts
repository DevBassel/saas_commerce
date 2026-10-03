import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';

export const REQUIRE_ACTIVE_SUBSCRIPTION = 'requireActiveSubscription';

export const RequireActiveSubscription = () =>
  SetMetadata(REQUIRE_ACTIVE_SUBSCRIPTION, true);

export const RequireSubscriptionFeature =
  Reflector.createDecorator<SubscriptionFeatureKey[]>();

export const RequireSubscriptionLimit =
  Reflector.createDecorator<SubscriptionLimitKey[]>();
