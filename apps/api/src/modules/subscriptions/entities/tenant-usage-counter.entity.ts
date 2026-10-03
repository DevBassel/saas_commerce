import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UsageMetric } from '../constants/usage-metric.enum';

@Entity('tenant_usage_counters')
@Unique(['tenantId', 'metric', 'periodStart'])
export class TenantUsageCounter extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  tenantId: number;

  @Column({ type: 'varchar', length: 64 })
  metric: UsageMetric;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'int', default: 0 })
  used: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
