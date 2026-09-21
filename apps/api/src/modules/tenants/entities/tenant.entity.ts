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

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status: TenantStatus;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
