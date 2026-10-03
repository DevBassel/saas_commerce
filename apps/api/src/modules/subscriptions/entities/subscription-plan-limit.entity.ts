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
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { LimitValueType } from '../constants/limit-value-type.enum';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('subscription_plan_limits')
@Unique(['planId', 'key'])
export class SubscriptionPlanLimit extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.limits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planId' })
  plan?: SubscriptionPlan;

  @Column({ type: 'int' })
  planId: number;

  @Column({ type: 'varchar', length: 64 })
  key: SubscriptionLimitKey;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
      to: (value: number | null): number | null => value,
    },
  })
  value: number | null;

  @Column({ type: 'enum', enum: LimitValueType })
  type: LimitValueType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
