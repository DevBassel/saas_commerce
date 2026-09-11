import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  key: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column({ default: false })
  isSystem: boolean;

  @ManyToMany(() => Permission)
  @JoinTable({ name: 'role_permissions' })
  permissions?: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
