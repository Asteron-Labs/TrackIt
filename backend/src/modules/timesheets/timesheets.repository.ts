import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { Goal } from '../goals/goals.entity';
import { Task } from '../tasks/tasks.entity';
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

export interface TimesheetHistoryEntryRecord {
  entry: TimesheetEntry;
  task: {
    id: string;
    title: string;
  };
  goal: {
    id: string;
    title: string;
  };
}

export interface DailyHoursTotal {
  workDate: string;
  totalHours: number;
}

export interface TaskHoursTotal {
  taskId: string;
  taskTitle: string;
  totalHours: number;
}

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

  findById(entryId: string): Promise<TimesheetEntry | null> {
    return this.repo.findOne({ where: { id: entryId } });
  }

  async delete(entryId: string): Promise<void> {
    await this.repo.delete(entryId);
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

  async findByEmployeeInRange(
    employeeId: string,
    from: string,
    to: string,
  ): Promise<TimesheetHistoryEntryRecord[]> {
    const query = this.repo
      .createQueryBuilder('entry')
      .innerJoin(Task, 'task', 'task.id = entry.task_id')
      .innerJoin(Goal, 'goal', 'goal.id = task.goal_id')
      .addSelect('task.id', 'history_task_id')
      .addSelect('task.title', 'history_task_title')
      .addSelect('goal.id', 'history_goal_id')
      .addSelect('goal.title', 'history_goal_title')
      .where('entry.employee_id = :employeeId', { employeeId })
      .andWhere('entry.work_date BETWEEN :from AND :to', { from, to })
      .orderBy('entry.work_date', 'DESC')
      .addOrderBy('entry.created_at', 'DESC');

    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((entry, index) => ({
      entry,
      task: {
        id: raw[index].history_task_id,
        title: raw[index].history_task_title,
      },
      goal: {
        id: raw[index].history_goal_id,
        title: raw[index].history_goal_title,
      },
    }));
  }

  async sumHoursByEmployeeGroupedByDate(
    employeeId: string,
    from: string,
    to: string,
  ): Promise<DailyHoursTotal[]> {
    const rows = await this.repo
      .createQueryBuilder('entry')
      .select('entry.work_date', 'workDate')
      .addSelect('SUM(entry.hours_spent)', 'totalHours')
      .where('entry.employee_id = :employeeId', { employeeId })
      .andWhere('entry.work_date BETWEEN :from AND :to', { from, to })
      .groupBy('entry.work_date')
      .orderBy('entry.work_date', 'DESC')
      .getRawMany<{ workDate: string; totalHours: string }>();

    return rows.map((row) => ({
      workDate: row.workDate,
      totalHours: Number(row.totalHours),
    }));
  }

  async sumHoursByEmployeeGroupedByTask(
    employeeId: string,
    from: string,
    to: string,
  ): Promise<TaskHoursTotal[]> {
    const rows = await this.repo
      .createQueryBuilder('entry')
      .innerJoin(Task, 'task', 'task.id = entry.task_id')
      .select('entry.task_id', 'taskId')
      .addSelect('task.title', 'taskTitle')
      .addSelect('SUM(entry.hours_spent)', 'totalHours')
      .where('entry.employee_id = :employeeId', { employeeId })
      .andWhere('entry.work_date BETWEEN :from AND :to', { from, to })
      .groupBy('entry.task_id')
      .addGroupBy('task.title')
      .orderBy('task.title', 'ASC')
      .getRawMany<{ taskId: string; taskTitle: string; totalHours: string }>();

    return rows.map((row) => ({
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      totalHours: Number(row.totalHours),
    }));
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
