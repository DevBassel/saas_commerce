import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Platform } from '../../auth/decorators/isPlatform.decorator';
import { Roles } from '../../auth/decorators/role.decorator';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { CurrencyRequestsService } from '../../currency-requests/currency-requests.service';
import { ListCurrencyChangeRequestsDto } from '../../currency-requests/dto/list-currency-change-requests.dto';
import { ReviewCurrencyChangeRequestDto } from '../../currency-requests/dto/review-currency-change-request.dto';

@Platform()
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform/currency-requests')
export class PlatformCurrencyRequestsController {
  constructor(private readonly currencyRequests: CurrencyRequestsService) {}

  @Get()
  list(@Query() query: ListCurrencyChangeRequestsDto) {
    return this.currencyRequests.list(query.status);
  }

  @Patch(':id/approve')
  approve(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.currencyRequests.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  reject(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewCurrencyChangeRequestDto,
  ) {
    return this.currencyRequests.reject(id, req.user.id, dto);
  }
}
