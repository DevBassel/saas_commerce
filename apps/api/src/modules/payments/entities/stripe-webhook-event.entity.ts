import type Stripe from 'stripe';
import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StripeWebhookEventStatus } from '../constants/stripe-webhook-event-status.enum';

@Entity('stripe_webhook_events')
@Check(
  'CHK_stripe_webhook_events_status',
  `"status" IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`,
)
@Index('UQ_stripe_webhook_events_event_id', ['stripeEventId'], {
  unique: true,
})
@Index('IDX_stripe_webhook_events_resource_created', [
  'resourceId',
  'stripeCreatedAt',
])
@Index('IDX_stripe_webhook_events_retry', ['status', 'nextRetryAt'])
export class StripeWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  stripeEventId: string;

  @Column({ type: 'varchar', length: 128 })
  eventType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId: string | null;

  @Column({ type: 'timestamptz' })
  stripeCreatedAt: Date;

  @Column({ type: 'jsonb' })
  payload: Stripe.Event;

  @Column({
    type: 'varchar',
    length: 16,
    default: StripeWebhookEventStatus.PENDING,
  })
  status: StripeWebhookEventStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  processingStartedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  processingToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
