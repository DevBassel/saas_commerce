import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { RolesType } from 'src/common/constants/Roles.enum';

@Entity()
export class User {
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

  @Column({ enum: RolesType, default: RolesType.USER })
  role: RolesType;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: null, nullable: true })
  jti: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
