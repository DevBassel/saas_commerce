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
import { RefundStatus } from '../constants/refund-status.enum';
import { SubscriptionPayment } from './subscription-payment.entity';
import { Subscription } from './subscription.entity';

@Entity('subscription_refunds')
export class SubscriptionRefund extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index({ unique: true })
  paymentId: number;

  @ManyToOne(() => SubscriptionPayment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment?: SubscriptionPayment;

  @Column({ type: 'int' })
  @Index()
  subscriptionId: number;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: Subscription;

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
