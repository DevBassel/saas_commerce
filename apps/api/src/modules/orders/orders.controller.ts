import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { OrderPermissionKey } from './constants/order-permissions.enum';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { CheckoutDto } from './dto/checkout.dto';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Permissions([OrderPermissionKey.CREATE])
  checkout(@Req() request: RequestWithUser, @Body() dto: CheckoutDto = {}) {
    return this.ordersService.checkout(request.user.id, dto);
  }

  @Get()
  @Permissions([OrderPermissionKey.READ])
  findAll(@Req() request: RequestWithUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.findAll(request.user, query);
  }

  @Get(':id')
  @Permissions([OrderPermissionKey.READ])
  findOne(
    @Req() request: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findOne(id, request.user);
  }

  @Patch(':id/cancel')
  @Permissions([OrderPermissionKey.CANCEL])
  cancel(
    @Req() request: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.cancel(id, request.user);
  }

  @Patch(':id/status')
  @Permissions([OrderPermissionKey.MANAGE])
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Patch(':id/return')
  @Permissions([OrderPermissionKey.RETURN])
  requestReturn(
    @Req() request: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.requestReturn(id, request.user);
  }
}
