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

  @Column({ default: TenantStatus.ACTIVE, enum: TenantStatus })
  status: TenantStatus;

  @Column()
  ownerUserId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
