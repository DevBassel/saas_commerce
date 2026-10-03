import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyColumn } from 'src/common/db/money-column';
import { Order } from 'src/modules/orders/entities/order.entity';
import { Coupon } from './coupon.entity';

@Entity('coupon_redemptions')
@Index(['couponId', 'orderId'], { unique: true })
@Index(['couponId', 'userId'])
export class CouponRedemption extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  couponId: number;

  @ManyToOne(() => Coupon, (coupon) => coupon.redemptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'couponId' })
  coupon?: Coupon;

  @Column({ type: 'int' })
  @Index()
  userId: number;

  @Column({ type: 'int' })
  @Index()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column(moneyColumn)
  discountAmount: number;

  @CreateDateColumn()
  createdAt: Date;
}
