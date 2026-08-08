import { ScopeService } from '../../common/authorization/scope.service';
import { MAX_DAILY_HOURS, MAX_TIMESHEET_HISTORY_RANGE_DAYS } from '../../common/config';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { TaskService } from '../tasks/tasks.service';
import { TimesheetEntry, TimesheetSubmissionStatus } from './timesheets.entity';
import {
  DailyHoursTotal,
  TaskTimesheetEntryRecord,
  TaskHoursTotal,
  TeamTimesheetEntryRecord,
  TimesheetHistoryEntryRecord,
  TimesheetRepository,
} from './timesheets.repository';

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

export interface TimesheetHistoryRangeInput {
  from?: string;
  to?: string;
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

export interface TimesheetHistoryEntryProjection extends TimesheetEntryProjection {
  task: {
    id: string;
    title: string;
  };
  goal: {
    id: string;
    title: string;
  };
}

export interface TimesheetHistoryResult {
  range: {
    from: string;
    to: string;
  };
  entries: TimesheetHistoryEntryProjection[];
  dailyTotals: DailyHoursTotal[];
  taskTotals: TaskHoursTotal[];
}

export interface TaskEffortEntryProjection extends TimesheetEntryProjection {
  employee: {
    id: string;
    name: string;
  };
}

export interface TaskEffortSource {
  actualHours: number;
  entries: TaskEffortEntryProjection[];
}

export interface TeamTimesheetEntryProjection extends TimesheetHistoryEntryProjection {
  employee: {
    id: string;
    name: string;
  };
}

export interface TeamTimesheetResult {
  range: {
    from: string;
    to: string;
  };
  entries: TeamTimesheetEntryProjection[];
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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

  async getMyHistory(
    callerId: string,
    requestedRange: TimesheetHistoryRangeInput = {},
  ): Promise<TimesheetHistoryResult> {
    const range = this.resolveHistoryRange(requestedRange);
    const [entryRecords, dailyTotals, taskTotals] = await Promise.all([
      this.timesheetRepository.findByEmployeeInRange(callerId, range.from, range.to),
      this.timesheetRepository.sumHoursByEmployeeGroupedByDate(callerId, range.from, range.to),
      this.timesheetRepository.sumHoursByEmployeeGroupedByTask(callerId, range.from, range.to),
    ]);

    return {
      range,
      entries: entryRecords.map((record) => this.toHistoryProjection(record)),
      dailyTotals,
      taskTotals,
    };
  }

  async getTaskEffortSource(taskId: string): Promise<TaskEffortSource> {
    const [totalsByTaskId, entryRecords] = await Promise.all([
      this.timesheetRepository.sumHoursByTaskIds([taskId]),
      this.timesheetRepository.findByTask(taskId),
    ]);

    return {
      actualHours: totalsByTaskId.get(taskId) ?? 0,
      entries: entryRecords.map((record) => this.toTaskEffortProjection(record)),
    };
  }

  async getTeamTimesheets(
    teamId: string,
    requestedRange: TimesheetHistoryRangeInput,
    caller: AuthenticatedUser,
  ): Promise<TeamTimesheetResult> {
    await this.scopeService.assertTeamLeadOf(caller.userId, teamId);
    const range = this.resolveHistoryRange(requestedRange);
    const entryRecords = await this.timesheetRepository.findByTeamInRange(
      teamId,
      range.from,
      range.to,
    );

    return {
      range,
      entries: entryRecords.map((record) => this.toTeamTimesheetProjection(record)),
    };
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

  private resolveHistoryRange(requestedRange: TimesheetHistoryRangeInput): {
    from: string;
    to: string;
  } {
    if (!requestedRange.from && !requestedRange.to) {
      return this.currentWeekRange();
    }
    if (!requestedRange.from || !requestedRange.to) {
      throw new ValidationError('Both from and to dates are required');
    }
    if (requestedRange.from > requestedRange.to) {
      throw new ValidationError('From date must be on or before to date');
    }

    const fromTime = Date.parse(`${requestedRange.from}T00:00:00.000Z`);
    const toTime = Date.parse(`${requestedRange.to}T00:00:00.000Z`);
    const inclusiveDays = (toTime - fromTime) / MILLISECONDS_PER_DAY + 1;
    if (inclusiveDays > MAX_TIMESHEET_HISTORY_RANGE_DAYS) {
      throw new ValidationError(
        `Date range cannot exceed ${MAX_TIMESHEET_HISTORY_RANGE_DAYS} days`,
      );
    }

    return { from: requestedRange.from, to: requestedRange.to };
  }

  private currentWeekRange(): { from: string; to: string } {
    const today = new Date();
    const daysSinceMonday = (today.getUTCDay() + 6) % 7;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - daysSinceMonday);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    };
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

  private toHistoryProjection(record: TimesheetHistoryEntryRecord): TimesheetHistoryEntryProjection {
    return {
      ...this.toProjection(record.entry),
      task: record.task,
      goal: record.goal,
    };
  }

  private toTaskEffortProjection(record: TaskTimesheetEntryRecord): TaskEffortEntryProjection {
    return {
      ...this.toProjection(record.entry),
      employee: record.employee,
    };
  }

  private toTeamTimesheetProjection(
    record: TeamTimesheetEntryRecord,
  ): TeamTimesheetEntryProjection {
    return {
      ...this.toHistoryProjection(record),
      employee: record.employee,
    };
  }
}
