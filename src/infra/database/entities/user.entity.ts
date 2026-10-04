import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 20 })
  userId: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'active_flag', type: 'char', length: 1, default: 'Y' })
  activeFlag: string;
}
