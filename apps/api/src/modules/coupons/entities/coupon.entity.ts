import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  moneyColumn,
  moneyColumnWithDefault,
} from 'src/common/db/money-column';
import { DiscountType } from '../constants/discount-type.enum';
import { CouponRedemption } from './coupon-redemption.entity';

@Entity('coupons')
export class Coupon extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  @Index({ unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: DiscountType })
  discountType: DiscountType;

  @Column(moneyColumn)
  discountValue: number;

  @Column(moneyColumnWithDefault(0))
  minOrderAmount: number;

  @Column({ ...moneyColumn, nullable: true })
  maxDiscountAmount?: number | null;

  @Column({ type: 'int', nullable: true })
  usageLimit?: number | null;

  @Column({ type: 'int', nullable: true })
  perUserLimit?: number | null;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'timestamp', nullable: true })
  startsAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  expiresAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  @OneToMany(() => CouponRedemption, (redemption) => redemption.coupon)
  redemptions?: CouponRedemption[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
