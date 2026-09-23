import { IsEnum } from 'class-validator';
import { OrderStatus } from '../constants/order-status.enum';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
