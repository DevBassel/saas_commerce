import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from 'src/modules/rbac/entities/role.entity';
import { Permission } from 'src/modules/rbac/entities/permission.entity';

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  @Index({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @ManyToOne(() => Role, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role?: Role;

  @Column({ type: 'int', nullable: true })
  roleId?: number | null;

  @ManyToMany(() => Permission)
  @JoinTable({ name: 'user_permissions' })
  permissions?: Permission[];

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: null, nullable: true })
  @Exclude()
  jti: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
