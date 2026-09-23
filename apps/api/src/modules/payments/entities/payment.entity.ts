import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from 'src/modules/orders/entities/order.entity';
import { PaymentStatus } from '../constants/payment-status.enum';

// Compile-only scaffold: the payment provider/service/controller land with the
// dedicated payments module. One row per payment attempt.
@Entity('payments')
export class Payment extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column()
  provider: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  status: PaymentStatus;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: {
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
      to: (value: number | null): number | null => value,
    },
  })
  amount: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
      to: (value: number | null): number | null => value,
    },
  })
  applicationFeeAmount: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
      to: (value: number | null): number | null => value,
    },
  })
  refundedAmount: number;

  @Column()
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  providerReference: string | null;

  @Column({ type: 'varchar', nullable: true })
  refundReference: string | null;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
