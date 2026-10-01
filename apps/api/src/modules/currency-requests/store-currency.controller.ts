import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/role.decorator';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { CurrencyRequestsService } from './currency-requests.service';
import { CreateCurrencyChangeRequestDto } from './dto/create-currency-change-request.dto';

@Controller('store/currency')
@Roles([RoleKey.STORE_OWNER])
export class StoreCurrencyController {
  constructor(private readonly currencyRequests: CurrencyRequestsService) {}

  @Get()
  getCurrency(@Req() req: RequestWithUser) {
    return this.currencyRequests.getForTenant(req.tenant!);
  }

  @Post('requests')
  createRequest(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCurrencyChangeRequestDto,
  ) {
    return this.currencyRequests.create(
      req.tenant!,
      { id: req.user.id, email: req.user.email },
      dto,
    );
  }

  @Patch('requests/:id/cancel')
  cancelRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.currencyRequests.cancel(req.tenant!, id);
  }
}
