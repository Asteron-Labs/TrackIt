import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_DAILY_HOURS } from '../../common/config';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { TaskProjection, TaskService } from '../tasks/tasks.service';
import { UserRole } from '../users/users.entity';
import { TimesheetEntry, TimesheetSubmissionStatus } from './timesheets.entity';
import {
  CreateTimesheetRecord,
  TimesheetRepository,
  UpdateTimesheetRecord,
} from './timesheets.repository';
import { TimesheetService } from './timesheets.service';

const EMPLOYEE_ID = '2894b41a-d903-421b-8cbb-4dbd48c836ab';
const OTHER_EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = 'ce379e12-9464-4f42-9f04-19e04be1b4d1';
const ENTRY_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';
const WORK_DATE = '2026-08-07';

const caller: AuthenticatedUser = {
  userId: EMPLOYEE_ID,
  role: UserRole.EMPLOYEE,
};

function taskProjection(assigneeId: string | null = EMPLOYEE_ID): TaskProjection {
  return { id: TASK_ID, assigneeId } as TaskProjection;
}

function timesheetEntry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: ENTRY_ID,
    employeeId: EMPLOYEE_ID,
    taskId: TASK_ID,
    workDate: WORK_DATE,
    hoursSpent: 2,
    workNote: 'Morning work',
    submissionStatus: TimesheetSubmissionStatus.SUBMITTED,
    createdAt: new Date('2026-08-07T08:00:00.000Z'),
    updatedAt: new Date('2026-08-07T08:00:00.000Z'),
    ...overrides,
  };
}

interface ServiceSetup {
  assigneeId?: string | null;
  dailyTotal?: number;
  existingEntry?: TimesheetEntry | null;
  taskError?: Error;
}

function createService(setup: ServiceSetup = {}) {
  const calls: string[] = [];
  const createdRecords: CreateTimesheetRecord[] = [];
  const updatedRecords: Array<{ id: string; changes: UpdateTimesheetRecord }> = [];

  const taskService = {
    async getTask(): Promise<TaskProjection> {
      calls.push('task');
      if (setup.taskError) throw setup.taskError;
      return taskProjection(
        Object.prototype.hasOwnProperty.call(setup, 'assigneeId') ? setup.assigneeId! : EMPLOYEE_ID,
      );
    },
  } as unknown as TaskService;

  const repository = {
    async sumHoursByEmployeeInRange(): Promise<number> {
      calls.push('daily-total');
      return setup.dailyTotal ?? 0;
    },
    async findByEmployeeAndTaskAndDate(): Promise<TimesheetEntry | null> {
      calls.push('duplicate');
      return setup.existingEntry ?? null;
    },
    async create(record: CreateTimesheetRecord): Promise<TimesheetEntry> {
      calls.push('create');
      createdRecords.push(record);
      return timesheetEntry(record);
    },
    async update(id: string, changes: UpdateTimesheetRecord): Promise<TimesheetEntry> {
      calls.push('update');
      updatedRecords.push({ id, changes });
      return timesheetEntry(changes);
    },
  } as unknown as TimesheetRepository;

  return {
    service: new TimesheetService(repository, taskService),
    calls,
    createdRecords,
    updatedRecords,
  };
}

test('logTime creates an entry and returns the new daily total', async () => {
  const { service, calls, createdRecords } = createService({ dailyTotal: 3 });

  const result = await service.logTime(
    { taskId: TASK_ID, workDate: WORK_DATE, hoursSpent: 2, workNote: 'Morning work' },
    caller,
  );

  assert.equal(result.created, true);
  assert.equal(result.dailyTotalHours, 5);
  assert.equal(result.timesheetEntry.hoursSpent, 2);
  assert.equal(result.timesheetEntry.workNote, 'Morning work');
  assert.equal('submissionStatus' in result.timesheetEntry, false);
  assert.deepEqual(calls, ['task', 'daily-total', 'duplicate', 'create']);
  assert.deepEqual(createdRecords[0], {
    employeeId: EMPLOYEE_ID,
    taskId: TASK_ID,
    workDate: WORK_DATE,
    hoursSpent: 2,
    workNote: 'Morning work',
    submissionStatus: TimesheetSubmissionStatus.SUBMITTED,
  });
});

test('logTime adds to a duplicate entry and appends its note', async () => {
  const existingEntry = timesheetEntry();
  const { service, updatedRecords } = createService({
    dailyTotal: 4,
    existingEntry,
  });

  const result = await service.logTime(
    { taskId: TASK_ID, workDate: WORK_DATE, hoursSpent: 3, workNote: 'Afternoon work' },
    caller,
  );

  assert.equal(result.created, false);
  assert.equal(result.dailyTotalHours, 7);
  assert.deepEqual(updatedRecords, [
    {
      id: ENTRY_ID,
      changes: {
        hoursSpent: 5,
        workNote: 'Morning work\nAfternoon work',
      },
    },
  ]);
});

test('logTime preserves an existing note when the added note is empty', async () => {
  const { service, updatedRecords } = createService({
    existingEntry: timesheetEntry(),
  });

  await service.logTime(
    { taskId: TASK_ID, workDate: WORK_DATE, hoursSpent: 1, workNote: '' },
    caller,
  );

  assert.equal(updatedRecords[0].changes.workNote, 'Morning work');
});

test('logTime rejects missing, unassigned, and other employees tasks before validation', async () => {
  const missing = createService({ taskError: new NotFoundError('Task not found') });
  await assert.rejects(
    missing.service.logTime({ taskId: TASK_ID, workDate: WORK_DATE, hoursSpent: 2 }, caller),
    NotFoundError,
  );
  assert.deepEqual(missing.calls, ['task']);

  for (const assigneeId of [null, OTHER_EMPLOYEE_ID]) {
    const setup = createService({ assigneeId });
    await assert.rejects(
      setup.service.logTime({ taskId: TASK_ID, workDate: WORK_DATE, hoursSpent: 2 }, caller),
      ForbiddenError,
    );
    assert.deepEqual(setup.calls, ['task']);
  }
});

for (const invalidHours of [0, -1, Number.NaN, MAX_DAILY_HOURS + 1]) {
  test(`logTime rejects invalid hours ${String(invalidHours)} before totaling the day`, async () => {
    const { service, calls } = createService();

    await assert.rejects(
      service.logTime({ taskId: TASK_ID, workDate: WORK_DATE, hoursSpent: invalidHours }, caller),
      ValidationError,
    );
    assert.deepEqual(calls, ['task']);
  });
}

test('logTime rejects a running daily total above the configured maximum', async () => {
  const { service, calls } = createService({ dailyTotal: MAX_DAILY_HOURS - 1 });

  await assert.rejects(
    service.logTime({ taskId: TASK_ID, workDate: WORK_DATE, hoursSpent: 2 }, caller),
    /Daily total cannot exceed 12 hours/,
  );
  assert.deepEqual(calls, ['task', 'daily-total']);
});

test('logTime rejects a future date after checking for a duplicate', async () => {
  const { service, calls } = createService();

  await assert.rejects(
    service.logTime({ taskId: TASK_ID, workDate: '2999-01-01', hoursSpent: 1 }, caller),
    /Work date cannot be in the future/,
  );
  assert.deepEqual(calls, ['task', 'daily-total', 'duplicate']);
});
