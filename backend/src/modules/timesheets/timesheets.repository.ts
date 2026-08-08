import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { TimesheetEntry, TimesheetSubmissionStatus } from './timesheets.entity';

export interface CreateTimesheetRecord {
  employeeId: string;
  taskId: string;
  workDate: string;
  hoursSpent: number;
  workNote: string;
  submissionStatus: TimesheetSubmissionStatus;
}

export type UpdateTimesheetRecord = Pick<TimesheetEntry, 'hoursSpent' | 'workNote'>;

export class TimesheetRepository extends BaseRepository<TimesheetEntry> {
  constructor(dataSource: DataSource) {
    super(dataSource, TimesheetEntry);
  }

  async create(record: CreateTimesheetRecord): Promise<TimesheetEntry> {
    const entry = this.repo.create(record);
    return this.repo.save(entry);
  }

  async update(entryId: string, changes: UpdateTimesheetRecord): Promise<TimesheetEntry> {
    await this.repo.update(entryId, changes);
    return this.repo.findOneByOrFail({ id: entryId });
  }

  findByEmployeeAndDate(employeeId: string, workDate: string): Promise<TimesheetEntry[]> {
    return this.repo.find({
      where: { employeeId, workDate },
      order: { createdAt: 'ASC' },
    });
  }

  findByEmployeeAndTaskAndDate(
    employeeId: string,
    taskId: string,
    workDate: string,
  ): Promise<TimesheetEntry | null> {
    return this.repo.findOne({ where: { employeeId, taskId, workDate } });
  }

  findByTask(taskId: string): Promise<TimesheetEntry[]> {
    return this.repo.find({
      where: { taskId },
      order: { workDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async sumHoursByTask(taskId: string): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.hours_spent), 0)', 'total')
      .where('entry.task_id = :taskId', { taskId })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  async sumHoursByEmployeeInRange(employeeId: string, from: string, to: string): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.hours_spent), 0)', 'total')
      .where('entry.employee_id = :employeeId', { employeeId })
      .andWhere('entry.work_date BETWEEN :from AND :to', { from, to })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }
}
