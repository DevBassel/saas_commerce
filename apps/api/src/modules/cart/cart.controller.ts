import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CartPermissionKey } from './constants/cart-permissions.enum';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Permissions([CartPermissionKey.READ])
  getCart(@Req() request: RequestWithUser) {
    return this.cartService.getCart(request.user.id);
  }

  @Post('items')
  @Permissions([CartPermissionKey.CREATE])
  addItem(@Req() request: RequestWithUser, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(request.user.id, dto);
  }

  @Patch('items/:productId')
  @Permissions([CartPermissionKey.UPDATE])
  updateItem(
    @Req() request: RequestWithUser,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(request.user.id, productId, dto);
  }

  @Delete('items/:productId')
  @Permissions([CartPermissionKey.DELETE])
  removeItem(
    @Req() request: RequestWithUser,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.cartService.removeItem(request.user.id, productId);
  }

  @Delete()
  @Permissions([CartPermissionKey.DELETE])
  clearCart(@Req() request: RequestWithUser) {
    return this.cartService.clearCart(request.user.id);
  }
}
