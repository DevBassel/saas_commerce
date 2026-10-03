import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CouponPermissionKey } from './constants/coupon-permissions.enum';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { UpdateCouponStatusDto } from './dto/update-coupon-status.dto';
import { ListCouponsQueryDto } from './dto/list-coupons.query.dto';
import {
  RequireActiveSubscription,
  RequireSubscriptionFeature,
  RequireSubscriptionLimit,
} from '../subscriptions/decorators/subscription.decorators';
import { SubscriptionFeatureKey } from '../subscriptions/constants/subscription-feature-key.enum';
import { SubscriptionLimitKey } from '../subscriptions/constants/subscription-limit-key.enum';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Static route declared before the `:id` param routes so `validate` is never
  // parsed as an id.
  @Post('validate')
  @Permissions([CouponPermissionKey.VALIDATE])
  validate(@Req() request: RequestWithUser, @Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto.code, request.user.id);
  }

  @Post()
  @Permissions([CouponPermissionKey.CREATE])
  @RequireActiveSubscription()
  @RequireSubscriptionFeature([SubscriptionFeatureKey.COUPONS])
  @RequireSubscriptionLimit([SubscriptionLimitKey.COUPONS_PER_MONTH])
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get()
  @Permissions([CouponPermissionKey.READ])
  findAll(@Query() query: ListCouponsQueryDto) {
    return this.couponsService.findAll(query);
  }

  @Get(':id')
  @Permissions([CouponPermissionKey.READ])
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.couponsService.findOne(id);
  }

  @Patch(':id/status')
  @Permissions([CouponPermissionKey.UPDATE])
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponStatusDto,
  ) {
    return this.couponsService.setStatus(id, dto.isActive);
  }

  @Patch(':id')
  @Permissions([CouponPermissionKey.UPDATE])
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions([CouponPermissionKey.DELETE])
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.couponsService.remove(id);
  }
}
