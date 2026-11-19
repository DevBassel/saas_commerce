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
import { moneyColumn } from 'src/common/db/money-column';
import { OrderStatus } from 'src/modules/orders/constants/order-status.enum';
import { Order } from 'src/modules/orders/entities/order.entity';
import { RefundStatus } from '../constants/refund-status.enum';
import { Payment } from './payment.entity';

@Entity('order_refunds')
export class OrderRefund extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index({ unique: true })
  paymentId: number;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment?: Payment;

  @Column({ type: 'int' })
  @Index()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column({ type: 'enum', enum: OrderStatus })
  sourceOrderStatus: OrderStatus;

  @Column({ type: 'enum', enum: OrderStatus })
  targetOrderStatus: OrderStatus;

  @Column(moneyColumn)
  amount: number;

  @Column()
  currency: string;

  @Column()
  @Index({ unique: true })
  idempotencyKey: string;

  @Column({ type: 'varchar', nullable: true })
  @Index({ unique: true })
  providerRefundId: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerStatus: string | null;

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.PENDING })
  status: RefundStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
