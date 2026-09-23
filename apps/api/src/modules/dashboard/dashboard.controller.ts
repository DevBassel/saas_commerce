import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { OrderPermissionKey } from '../orders/constants/order-permissions.enum';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Permissions([OrderPermissionKey.MANAGE])
  getStats() {
    return this.dashboardService.getStats();
  }
}
