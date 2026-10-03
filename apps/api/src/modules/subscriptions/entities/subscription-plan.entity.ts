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
import { moneyColumnWithDefault } from 'src/common/db/money-column';
import { SubscriptionPlanLimit } from './subscription-plan-limit.entity';
import { SubscriptionPlanFeature } from './subscription-plan-feature.entity';
import { Subscription } from './subscription.entity';

@Entity('subscription_plans')
export class SubscriptionPlan extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  @Index({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column(moneyColumnWithDefault(0))
  monthlyPrice: number;

  @Column(moneyColumnWithDefault(0))
  yearlyPrice: number;

  @Column({ type: 'varchar', length: 3, default: 'usd' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  @Index()
  active: boolean;

  @Column({ name: 'public', type: 'boolean', default: true })
  @Index()
  isPublic: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'int', default: 0 })
  trialDays: number;

  @OneToMany(() => SubscriptionPlanLimit, (limit) => limit.plan)
  limits?: SubscriptionPlanLimit[];

  @OneToMany(() => SubscriptionPlanFeature, (feature) => feature.plan)
  features?: SubscriptionPlanFeature[];

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscriptions?: Subscription[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
