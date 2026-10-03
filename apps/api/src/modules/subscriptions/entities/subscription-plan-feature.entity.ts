import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('subscription_plan_features')
@Unique(['planId', 'key'])
export class SubscriptionPlanFeature extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.features, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planId' })
  plan?: SubscriptionPlan;

  @Column({ type: 'int' })
  planId: number;

  @Column({ type: 'varchar', length: 64 })
  key: SubscriptionFeatureKey;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
