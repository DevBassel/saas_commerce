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
import {
  moneyColumn,
  moneyColumnWithDefault,
} from 'src/common/db/money-column';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';
import { PaymentStatus } from '../constants/payment-status.enum';
import { PaymentsProviders } from '../constants/payments-providers';
import { Subscription } from './subscription.entity';

@Entity('subscription_payments')
export class SubscriptionPayment extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  subscriptionId: number;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: Subscription;

  @Column({ type: 'int' })
  @Index()
  planId: number;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY,
  })
  billingInterval: BillingInterval;

  @Column({ type: 'enum', enum: PaymentsProviders })
  provider: PaymentsProviders;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  status: PaymentStatus;

  @Column(moneyColumn)
  amount: number;

  @Column()
  currency: string;

  @Column({ nullable: true })
  paymentRef: string;

  @Column({ type: 'varchar', nullable: true })
  providerReference: string | null;

  @Column({ type: 'varchar', nullable: true })
  refundReference: string | null;

  @Column(moneyColumnWithDefault(0))
  refundedAmount: number;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  planAppliedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundDowngradedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
  idempotencyKey: string | undefined;
}
