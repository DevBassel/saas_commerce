import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/role.decorator';
import { Platform } from '../../auth/decorators/isPlatform.decorator';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { PlatformPaymentsService } from './platform-payments.service';
import { PauseToggleDto } from './dto/pause-toggle.dto';

@Platform()
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform/payments')
export class PlatformPaymentsController {
  constructor(private readonly paymentsService: PlatformPaymentsService) {}

  @Get()
  listTenants() {
    return this.paymentsService.listTenants();
  }

  @Get(':tenantId')
  getOverview(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.paymentsService.getOverview(tenantId);
  }

  @Get(':tenantId/charges')
  listCharges(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.paymentsService.listCharges(tenantId, page, limit);
  }

  @Get(':tenantId/payouts')
  listPayouts(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('startingAfter') startingAfter?: string,
  ) {
    return this.paymentsService.listPayouts(tenantId, limit, startingAfter);
  }

  @Patch(':tenantId/payments-paused')
  setPaymentsPaused(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PauseToggleDto,
  ) {
    return this.paymentsService.setPaymentsPaused(tenantId, dto.paused);
  }

  @Patch(':tenantId/payouts-paused')
  setPayoutsPaused(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PauseToggleDto,
  ) {
    return this.paymentsService.setPayoutsPaused(tenantId, dto.paused);
  }
}
