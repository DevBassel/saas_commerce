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
import { Product } from 'src/modules/products/entities/product.entity';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column({ type: 'int', nullable: true })
  @Index()
  productId?: number | null;

  @ManyToOne(() => Product, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product?: Product | null;

  @Column()
  name: string;

  @Column()
  sku: string;

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
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

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
  lineTotal: number;

  @Column({ type: 'varchar', nullable: true })
  imageObjectKey?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
