import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { OtpPurpose } from '../constants/otp-purpose.enum';

@Entity('otp_challenges')
@Index(['userId', 'purpose'], {
  unique: true,
  where: '"consumedAt" IS NULL',
})
export class OtpChallenge extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  @Index()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 320 })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 32 })
  purpose: OtpPurpose;

  @Column({ type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int' })
  maxAttempts: number;

  @Column({ type: 'int', default: 1 })
  requestCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
