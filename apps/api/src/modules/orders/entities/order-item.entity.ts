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
import { moneyColumn } from 'src/common/db/money-column';
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

  @Column(moneyColumn)
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column(moneyColumn)
  lineTotal: number;

  @Column({ type: 'varchar', nullable: true })
  imageObjectKey?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
