import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum TimesheetSubmissionStatus {
  SUBMITTED = 'SUBMITTED',
}

@Entity({ name: 'timesheet_entries' })
@Index('IDX_timesheet_entries_employee_work_date', ['employeeId', 'workDate'])
@Unique('UQ_timesheet_entries_employee_task_work_date', ['employeeId', 'taskId', 'workDate'])
export class TimesheetEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate!: string;

  @Column({
    name: 'hours_spent',
    type: 'numeric',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  hoursSpent!: number;

  @Column({ name: 'work_note', type: 'text', default: '' })
  workNote!: string;

  @Column({
    name: 'submission_status',
    type: 'enum',
    enum: TimesheetSubmissionStatus,
    enumName: 'timesheet_submission_status_enum',
    default: TimesheetSubmissionStatus.SUBMITTED,
  })
  submissionStatus!: TimesheetSubmissionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
