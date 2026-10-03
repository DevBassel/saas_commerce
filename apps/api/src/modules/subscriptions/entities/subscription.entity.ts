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
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { BillingInterval } from '../constants/billing-interval.enum';
import { SubscriptionStatus } from '../constants/subscription-status.enum';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('subscriptions')
export class Subscription extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: Tenant;

  @Column({ type: 'int' })
  @Index({ unique: true })
  tenantId: number;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.subscriptions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'planId' })
  plan?: SubscriptionPlan;

  @Column({ type: 'int' })
  @Index()
  planId: number;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY,
  })
  billingInterval: BillingInterval;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeCustomerId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripePriceId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  trialStart: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  trialEnd: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
