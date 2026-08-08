import { ScopeService } from '../../common/authorization/scope.service';
import { MAX_DAILY_HOURS } from '../../common/config';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
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

export interface UpdateTimeEntryDto {
  hoursSpent?: number;
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

export interface UpdateTimeEntryResult {
  timesheetEntry: TimesheetEntryProjection;
  dailyTotalHours: number;
}

export class TimesheetService {
  constructor(
    private readonly timesheetRepository: TimesheetRepository,
    private readonly taskService: TaskService,
    private readonly scopeService: ScopeService,
  ) {}

  async logTime(dto: LogTimeDto, caller: AuthenticatedUser): Promise<LogTimeResult> {
    const task = await this.taskService.getTask(dto.taskId, caller);
    if (task.assigneeId !== caller.userId) {
      throw new ForbiddenError('You can only log time against your own assigned tasks');
    }

    const dailyTotalHours = await this.validateEntryHours(
      caller.userId,
      dto.workDate,
      dto.hoursSpent,
    );

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

  async updateEntry(
    entryId: string,
    dto: UpdateTimeEntryDto,
    caller: AuthenticatedUser,
  ): Promise<UpdateTimeEntryResult> {
    const existingEntry = await this.timesheetRepository.findById(entryId);
    if (!existingEntry) {
      throw new NotFoundError('Timesheet entry not found');
    }

    this.scopeService.assertOwnsResource(caller.userId, existingEntry.employeeId);

    const hoursSpent = dto.hoursSpent ?? existingEntry.hoursSpent;
    const dailyTotalHours = await this.validateEntryHours(
      caller.userId,
      existingEntry.workDate,
      hoursSpent,
      existingEntry.hoursSpent,
    );
    const updatedEntry = await this.timesheetRepository.update(entryId, {
      hoursSpent,
      workNote: dto.workNote ?? existingEntry.workNote,
    });

    return {
      timesheetEntry: this.toProjection(updatedEntry),
      dailyTotalHours,
    };
  }

  async deleteEntry(entryId: string, caller: AuthenticatedUser): Promise<void> {
    const existingEntry = await this.timesheetRepository.findById(entryId);
    if (!existingEntry) {
      throw new NotFoundError('Timesheet entry not found');
    }

    this.scopeService.assertOwnsResource(caller.userId, existingEntry.employeeId);
    await this.timesheetRepository.delete(entryId);
  }

  private async validateEntryHours(
    employeeId: string,
    workDate: string,
    hoursSpent: number,
    replacedHours = 0,
  ): Promise<number> {
    if (!Number.isFinite(hoursSpent) || hoursSpent <= 0) {
      throw new ValidationError('Hours spent must be greater than zero');
    }
    if (hoursSpent > MAX_DAILY_HOURS) {
      throw new ValidationError(`Hours spent cannot exceed ${MAX_DAILY_HOURS} hours`);
    }

    const currentDailyTotal = await this.timesheetRepository.sumHoursByEmployeeInRange(
      employeeId,
      workDate,
      workDate,
    );
    const dailyTotalHours = currentDailyTotal - replacedHours + hoursSpent;
    if (dailyTotalHours > MAX_DAILY_HOURS) {
      throw new ValidationError(`Daily total cannot exceed ${MAX_DAILY_HOURS} hours`);
    }

    return dailyTotalHours;
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
