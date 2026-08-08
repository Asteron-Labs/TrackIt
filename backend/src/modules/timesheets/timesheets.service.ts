import { MAX_DAILY_HOURS } from '../../common/config';
import { ForbiddenError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { TaskService } from '../tasks/tasks.service';
import { TimesheetEntry, TimesheetSubmissionStatus } from './timesheets.entity';
import { TimesheetRepository } from './timesheets.repository';

export interface LogTimeDto {
  taskId: string;
  workDate: string;
  hoursSpent: number;
  workNote?: string;
}

export interface TimesheetEntryProjection {
  id: string;
  employeeId: string;
  taskId: string;
  workDate: string;
  hoursSpent: number;
  workNote: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogTimeResult {
  timesheetEntry: TimesheetEntryProjection;
  dailyTotalHours: number;
  created: boolean;
}

export class TimesheetService {
  constructor(
    private readonly timesheetRepository: TimesheetRepository,
    private readonly taskService: TaskService,
  ) {}

  async logTime(dto: LogTimeDto, caller: AuthenticatedUser): Promise<LogTimeResult> {
    const task = await this.taskService.getTask(dto.taskId, caller);
    if (task.assigneeId !== caller.userId) {
      throw new ForbiddenError('You can only log time against your own assigned tasks');
    }

    this.assertValidHours(dto.hoursSpent);

    const currentDailyTotal = await this.timesheetRepository.sumHoursByEmployeeInRange(
      caller.userId,
      dto.workDate,
      dto.workDate,
    );
    const dailyTotalHours = currentDailyTotal + dto.hoursSpent;
    if (dailyTotalHours > MAX_DAILY_HOURS) {
      throw new ValidationError(`Daily total cannot exceed ${MAX_DAILY_HOURS} hours`);
    }

    const existingEntry = await this.timesheetRepository.findByEmployeeAndTaskAndDate(
      caller.userId,
      dto.taskId,
      dto.workDate,
    );

    const today = new Date().toISOString().slice(0, 10);
    if (dto.workDate > today) {
      throw new ValidationError('Work date cannot be in the future');
    }

    if (existingEntry) {
      const updatedEntry = await this.timesheetRepository.update(existingEntry.id, {
        hoursSpent: existingEntry.hoursSpent + dto.hoursSpent,
        workNote: this.appendWorkNote(existingEntry.workNote, dto.workNote),
      });
      return {
        timesheetEntry: this.toProjection(updatedEntry),
        dailyTotalHours,
        created: false,
      };
    }

    const entry = await this.timesheetRepository.create({
      employeeId: caller.userId,
      taskId: dto.taskId,
      workDate: dto.workDate,
      hoursSpent: dto.hoursSpent,
      workNote: dto.workNote ?? '',
      submissionStatus: TimesheetSubmissionStatus.SUBMITTED,
    });

    return {
      timesheetEntry: this.toProjection(entry),
      dailyTotalHours,
      created: true,
    };
  }

  private assertValidHours(hoursSpent: number): void {
    if (!Number.isFinite(hoursSpent) || hoursSpent <= 0) {
      throw new ValidationError('Hours spent must be greater than zero');
    }
    if (hoursSpent > MAX_DAILY_HOURS) {
      throw new ValidationError(`Hours spent cannot exceed ${MAX_DAILY_HOURS} hours`);
    }
  }

  private appendWorkNote(existingNote: string, newNote?: string): string {
    if (!newNote) return existingNote;
    if (!existingNote) return newNote;
    return `${existingNote}\n${newNote}`;
  }

  private toProjection(entry: TimesheetEntry): TimesheetEntryProjection {
    return {
      id: entry.id,
      employeeId: entry.employeeId,
      taskId: entry.taskId,
      workDate: entry.workDate,
      hoursSpent: entry.hoursSpent,
      workNote: entry.workNote,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
