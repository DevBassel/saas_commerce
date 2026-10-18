import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Platform } from '../auth/decorators/isPlatform.decorator';
import { Roles } from '../auth/decorators/role.decorator';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import StripePaymentService from './stripe.payment.service';

/**
 * Platform (Super Admin) subscription payment actions. Lives in `PaymentsModule`
 * because the free-plan fallback needs `SubscriptionService` and the refund
 * needs `StripePaymentService`; `SubscriptionsModule` cannot import it without
 * creating a module cycle.
 */
@Platform()
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform/tenants')
export default class PlatformSubscriptionPaymentController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}

  @Post(':id/subscription/cancel')
  cancelAndRefund(@Param('id', ParseIntPipe) id: number) {
    return this.stripePaymentService.cancelSubscriptionWithRefund(id);
  }
}
