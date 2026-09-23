import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { PaymentStatus } from 'src/modules/payments/constants/payment-status.enum';
import { Address } from 'src/modules/addresses/entities/address.entity';
import { OrderStatus } from '../constants/order-status.enum';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  orderNumber: string;

  @Column({ type: 'int', nullable: true })
  @Index()
  userId?: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  paymentStatus: PaymentStatus;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: {
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
      to: (value: number | null): number | null => value,
    },
  })
  subtotal: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: {
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
      to: (value: number | null): number | null => value,
    },
  })
  total: number;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  @Index()
  addressId?: number | null;

  @ManyToOne(() => Address, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'addressId' })
  address?: Address | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientName?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  line1?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  line2?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  postalCode?: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country?: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert'] })
  items?: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
