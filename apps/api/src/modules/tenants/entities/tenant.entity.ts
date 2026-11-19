import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantStatus } from '../enums/tenantStatus.enum';
import { TenantProvisioningState } from '../enums/tenant-provisioning-state.enum';
import { Exclude } from 'class-transformer';

@Entity('tenants')
export class Tenant extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  @Index({ unique: true })
  slug: string;

  @Column()
  @Index({ unique: true })
  schemaName: string;

  @Column({ nullable: true })
  @Index({ unique: true })
  subdomain: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.INACTIVE })
  status: TenantStatus;

  @Column({
    type: 'enum',
    enum: TenantProvisioningState,
    enumName: 'tenant_provisioning_state_enum',
    default: TenantProvisioningState.PENDING,
  })
  provisioningState: TenantProvisioningState;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  provisioningOwnerEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  provisioningOwnerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  provisioningOwnerPasswordHash: string | null;

  @Column({ type: 'int', default: 0 })
  provisioningAttempts: number;

  @Column({
    type: 'enum',
    enum: TenantProvisioningState,
    enumName: 'tenant_provisioning_state_enum',
    nullable: true,
  })
  provisioningFailedStep: TenantProvisioningState | null;

  @Column({ type: 'text', nullable: true })
  @Exclude()
  provisioningLastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  provisioningFailedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  ownerUserId?: number | null;

  @Column({
    type: 'bigint',
    default: 0,
  })
  storageUsedBytes: bigint;

  @Column({
    type: 'bigint',
  })
  storageCapacityBytes: bigint;

  @Column({
    type: 'varchar',
    nullable: true,
    unique: true,
  })
  stripeAccountId: string | null;

  @Column({ type: 'boolean', default: false })
  stripeChargesEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  stripePayoutsEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  stripeDetailsSubmitted: boolean;

  @Column({ type: 'boolean', default: false })
  paymentsPaused: boolean;

  @Column({ type: 'boolean', default: false })
  payoutsPaused: boolean;

  @Column({ type: 'varchar', nullable: true })
  stripePayoutsInterval: string | null;

  @Column({ type: 'varchar', length: 3, default: 'usd' })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
