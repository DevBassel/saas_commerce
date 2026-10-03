import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
} from '@nestjs/common';
import { Platform } from '../../auth/decorators/isPlatform.decorator';
import { Roles } from '../../auth/decorators/role.decorator';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { SubscriptionService } from '../services/subscription.service';
import { SubscriptionUsageService } from '../services/subscription-usage.service';
import { AssignSubscriptionDto } from '../dto/assign-subscription.dto';
import { UpdateSubscriptionStatusDto } from '../dto/update-subscription-status.dto';

@Platform()
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform/tenants')
export class PlatformTenantSubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly usage: SubscriptionUsageService,
  ) {}

  @Get(':id/subscription')
  findSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptions.getPlanForTenantId(id);
  }

  @Get(':id/subscription/usage')
  findUsage(@Param('id', ParseIntPipe) id: number) {
    return this.usage.getUsageSummaryByTenantId(id);
  }

  @Put(':id/subscription')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignSubscriptionDto,
  ) {
    return this.subscriptions.assignPlan(id, dto);
  }

  @Patch(':id/subscription/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionStatusDto,
  ) {
    return this.subscriptions.updateStatus(id, dto.status);
  }
}
