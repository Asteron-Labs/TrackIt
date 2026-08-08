import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TEAM_LEAD = 'TEAM_LEAD',
  EMPLOYEE = 'EMPLOYEE',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role_enum' })
  role!: UserRole;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
