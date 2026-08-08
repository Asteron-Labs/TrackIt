import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum GoalStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum GoalImportance {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

@Entity({ name: 'goals' })
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  deadline!: string;

  @Column({
    type: 'enum',
    enum: GoalStatus,
    enumName: 'goal_status_enum',
    default: GoalStatus.PLANNED,
  })
  status!: GoalStatus;

  @Column({ type: 'enum', enum: GoalImportance, enumName: 'goal_importance_enum' })
  importance!: GoalImportance;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
