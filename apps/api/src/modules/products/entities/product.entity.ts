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
import { ProductImage } from './product-image.entity';
import { Category } from '../../categories/entities/category.entity';
import { moneyColumn } from '../../../common/db/money-column';

@Entity('products')
export class Product extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  @Index({ unique: true })
  sku: string;

  @Column({ type: 'varchar', nullable: true })
  @Index({ unique: true })
  slug: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column(moneyColumn)
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  @Index()
  categoryId?: number | null;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'categoryId' })
  category?: Category | null;

  @OneToMany(() => ProductImage, (image) => image.product, {
    cascade: ['insert'],
  })
  images?: ProductImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
