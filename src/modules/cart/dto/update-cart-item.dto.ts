import { IsInt, Max, Min } from 'class-validator';
import { MAX_CART_ITEM_QUANTITY } from '../constants/cart.constants';

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity: number;
}
