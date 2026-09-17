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
import { Product } from './product.entity';

@Entity('product_images')
export class ProductImage extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product?: Product;

  @Column()
  @Index({ unique: true })
  objectKey: string;

  @Column({
    type: 'bigint',
    transformer: {
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
      to: (value: number | null): number | null => value,
    },
  })
  sizeBytes: number;

  @Column()
  mimeType: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;
}
