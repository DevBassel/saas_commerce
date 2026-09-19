import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_CART_ITEM_QUANTITY } from '../constants/cart.constants';

export class AddCartItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity?: number;
}
