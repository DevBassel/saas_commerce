import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CurrencyChangeRequestStatus } from '../enums/currency-change-request-status.enum';

@Entity('currency_change_requests')
@Index('UQ_currency_change_requests_pending_tenant', ['tenantId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
export class CurrencyChangeRequest extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  tenantId: number;

  @Column({ type: 'int', nullable: true })
  requestedById: number | null;

  @Column({ type: 'varchar', nullable: true })
  requestedByEmail: string | null;

  @Column({ type: 'varchar', length: 3 })
  currentCurrency: string;

  @Column({ type: 'varchar', length: 3 })
  requestedCurrency: string;

  @Column({
    type: 'enum',
    enum: CurrencyChangeRequestStatus,
    default: CurrencyChangeRequestStatus.PENDING,
  })
  @Index()
  status: CurrencyChangeRequestStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reviewNote: string | null;

  @Column({ type: 'int', nullable: true })
  reviewedById: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
