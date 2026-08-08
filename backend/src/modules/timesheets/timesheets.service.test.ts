import assert from 'node:assert/strict';
import test from 'node:test';
import { ScopeService } from '../../common/authorization/scope.service';
import { MAX_DAILY_HOURS, MAX_TIMESHEET_HISTORY_RANGE_DAYS } from '../../common/config';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { TaskProjection, TaskService } from '../tasks/tasks.service';
import { UserRole } from '../users/users.entity';
import { TimesheetEntry, TimesheetSubmissionStatus } from './timesheets.entity';
import {
  CreateTimesheetRecord,
  DailyHoursTotal,
  TaskTimesheetEntryRecord,
  TaskHoursTotal,
  TeamTimesheetEntryRecord,
  TimesheetHistoryEntryRecord,
  TimesheetRepository,
  UpdateTimesheetRecord,
} from './timesheets.repository';
import { TimesheetService } from './timesheets.service';

const EMPLOYEE_ID = '2894b41a-d903-421b-8cbb-4dbd48c836ab';
const OTHER_EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = 'ce379e12-9464-4f42-9f04-19e04be1b4d1';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
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
  entryById?: TimesheetEntry | null;
  taskError?: Error;
  historyEntries?: TimesheetHistoryEntryRecord[];
  dailyHistoryTotals?: DailyHoursTotal[];
  taskHistoryTotals?: TaskHoursTotal[];
  effortTotal?: number;
  taskEffortEntries?: TaskTimesheetEntryRecord[];
  teamEntries?: TeamTimesheetEntryRecord[];
  teamLeadError?: Error;
}

function createService(setup: ServiceSetup = {}) {
  const calls: string[] = [];
  const createdRecords: CreateTimesheetRecord[] = [];
  const updatedRecords: Array<{ id: string; changes: UpdateTimesheetRecord }> = [];
  const deletedIds: string[] = [];
  const historyCalls: Array<{
    method: string;
    employeeId: string;
    from: string;
    to: string;
  }> = [];
  const teamCalls: Array<{ teamId: string; from: string; to: string }> = [];

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
    async findById(): Promise<TimesheetEntry | null> {
      calls.push('find-entry');
      if (Object.prototype.hasOwnProperty.call(setup, 'entryById')) {
        return setup.entryById!;
      }
      return timesheetEntry();
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
    async delete(id: string): Promise<void> {
      calls.push('delete');
      deletedIds.push(id);
    },
    async findByEmployeeInRange(
      employeeId: string,
      from: string,
      to: string,
    ): Promise<TimesheetHistoryEntryRecord[]> {
      historyCalls.push({ method: 'entries', employeeId, from, to });
      return setup.historyEntries ?? [];
    },
    async sumHoursByEmployeeGroupedByDate(
      employeeId: string,
      from: string,
      to: string,
    ): Promise<DailyHoursTotal[]> {
      historyCalls.push({ method: 'daily', employeeId, from, to });
      return setup.dailyHistoryTotals ?? [];
    },
    async sumHoursByEmployeeGroupedByTask(
      employeeId: string,
      from: string,
      to: string,
    ): Promise<TaskHoursTotal[]> {
      historyCalls.push({ method: 'tasks', employeeId, from, to });
      return setup.taskHistoryTotals ?? [];
    },
    async sumHoursByTaskIds(taskIds: string[]): Promise<Map<string, number>> {
      calls.push('task-totals');
      return new Map(taskIds.map((taskId) => [taskId, setup.effortTotal ?? 0]));
    },
    async findByTask(): Promise<TaskTimesheetEntryRecord[]> {
      calls.push('task-entries');
      return setup.taskEffortEntries ?? [];
    },
    async findByTeamInRange(
      teamId: string,
      from: string,
      to: string,
    ): Promise<TeamTimesheetEntryRecord[]> {
      teamCalls.push({ teamId, from, to });
      return setup.teamEntries ?? [];
    },
  } as unknown as TimesheetRepository;

  const scopeService = {
    assertOwnsResource(userId: string, resourceOwnerId: string): void {
      calls.push('ownership');
      if (userId !== resourceOwnerId) throw new ForbiddenError();
    },
    async assertTeamLeadOf(): Promise<void> {
      calls.push('team-scope');
      if (setup.teamLeadError) throw setup.teamLeadError;
    },
  } as unknown as ScopeService;

  return {
    service: new TimesheetService(repository, taskService, scopeService),
    calls,
    createdRecords,
    updatedRecords,
    deletedIds,
    historyCalls,
    teamCalls,
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
  const { service, updatedRecords } = createService({
    dailyTotal: 4,
    existingEntry: timesheetEntry(),
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
  const { service, updatedRecords } = createService({ existingEntry: timesheetEntry() });

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

test('updateEntry replaces hours and note and returns the adjusted daily total', async () => {
  const { service, calls, updatedRecords } = createService({ dailyTotal: 7 });

  const result = await service.updateEntry(
    ENTRY_ID,
    { hoursSpent: 4, workNote: 'Corrected work' },
    caller,
  );

  assert.equal(result.dailyTotalHours, 9);
  assert.equal(result.timesheetEntry.hoursSpent, 4);
  assert.equal(result.timesheetEntry.workNote, 'Corrected work');
  assert.deepEqual(calls, ['find-entry', 'ownership', 'daily-total', 'update']);
  assert.deepEqual(updatedRecords, [
    {
      id: ENTRY_ID,
      changes: { hoursSpent: 4, workNote: 'Corrected work' },
    },
  ]);
});

test('updateEntry preserves omitted fields and allows clearing the work note', async () => {
  const { service, updatedRecords } = createService({ dailyTotal: 7 });

  const result = await service.updateEntry(ENTRY_ID, { workNote: '' }, caller);

  assert.equal(result.dailyTotalHours, 7);
  assert.deepEqual(updatedRecords[0].changes, { hoursSpent: 2, workNote: '' });
});

for (const invalidHours of [0, -1, Number.NaN, MAX_DAILY_HOURS + 1]) {
  test(`updateEntry rejects invalid replacement hours ${String(invalidHours)}`, async () => {
    const { service, calls } = createService();

    await assert.rejects(
      service.updateEntry(ENTRY_ID, { hoursSpent: invalidHours }, caller),
      ValidationError,
    );
    assert.deepEqual(calls, ['find-entry', 'ownership']);
  });
}

test('updateEntry rejects an adjusted daily total above the configured maximum', async () => {
  const { service, calls } = createService({ dailyTotal: 11 });

  await assert.rejects(
    service.updateEntry(ENTRY_ID, { hoursSpent: 4 }, caller),
    /Daily total cannot exceed 12 hours/,
  );
  assert.deepEqual(calls, ['find-entry', 'ownership', 'daily-total']);
});

test('updateEntry returns 404 when the entry does not exist', async () => {
  const { service, calls } = createService({ entryById: null });

  await assert.rejects(service.updateEntry(ENTRY_ID, { hoursSpent: 3 }, caller), NotFoundError);
  assert.deepEqual(calls, ['find-entry']);
});

test('updateEntry rejects another employees entry before validation or mutation', async () => {
  const { service, calls } = createService({
    entryById: timesheetEntry({ employeeId: OTHER_EMPLOYEE_ID }),
  });

  await assert.rejects(service.updateEntry(ENTRY_ID, { hoursSpent: 3 }, caller), ForbiddenError);
  assert.deepEqual(calls, ['find-entry', 'ownership']);
});

test('deleteEntry deletes an owned entry', async () => {
  const { service, calls, deletedIds } = createService();

  await service.deleteEntry(ENTRY_ID, caller);

  assert.deepEqual(calls, ['find-entry', 'ownership', 'delete']);
  assert.deepEqual(deletedIds, [ENTRY_ID]);
});

test('deleteEntry returns 404 for a missing entry and 403 for another employees entry', async () => {
  const missing = createService({ entryById: null });
  await assert.rejects(missing.service.deleteEntry(ENTRY_ID, caller), NotFoundError);
  assert.deepEqual(missing.calls, ['find-entry']);

  const forbidden = createService({
    entryById: timesheetEntry({ employeeId: OTHER_EMPLOYEE_ID }),
  });
  await assert.rejects(forbidden.service.deleteEntry(ENTRY_ID, caller), ForbiddenError);
  assert.deepEqual(forbidden.calls, ['find-entry', 'ownership']);
});

test('getMyHistory defaults to the current Monday-to-Sunday week', async () => {
  const { service, historyCalls } = createService();

  const result = await service.getMyHistory(EMPLOYEE_ID);

  const from = new Date(`${result.range.from}T00:00:00.000Z`);
  const to = new Date(`${result.range.to}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(from.getUTCDay(), 1);
  assert.equal(to.getUTCDay(), 0);
  assert.equal((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000), 6);
  assert.ok(result.range.from <= today && today <= result.range.to);
  assert.deepEqual(historyCalls, [
    { method: 'entries', employeeId: EMPLOYEE_ID, ...result.range },
    { method: 'daily', employeeId: EMPLOYEE_ID, ...result.range },
    { method: 'tasks', employeeId: EMPLOYEE_ID, ...result.range },
  ]);
});

test('getMyHistory returns joined entries and both repository rollups', async () => {
  const entry = timesheetEntry({ workDate: '2026-08-07' });
  const dailyTotals = [{ workDate: '2026-08-07', totalHours: 2 }];
  const taskTotals = [{ taskId: TASK_ID, taskTitle: 'Implement history', totalHours: 2 }];
  const setup = createService({
    historyEntries: [
      {
        entry,
        task: { id: TASK_ID, title: 'Implement history' },
        goal: { id: 'goal-id', title: 'Track effort' },
      },
    ],
    dailyHistoryTotals: dailyTotals,
    taskHistoryTotals: taskTotals,
  });

  const result = await setup.service.getMyHistory(EMPLOYEE_ID, {
    from: '2026-08-01',
    to: '2026-08-07',
  });

  assert.deepEqual(result.range, { from: '2026-08-01', to: '2026-08-07' });
  assert.deepEqual(result.entries[0].task, { id: TASK_ID, title: 'Implement history' });
  assert.deepEqual(result.entries[0].goal, { id: 'goal-id', title: 'Track effort' });
  assert.equal('submissionStatus' in result.entries[0], false);
  assert.deepEqual(result.dailyTotals, dailyTotals);
  assert.deepEqual(result.taskTotals, taskTotals);
  assert.deepEqual(setup.historyCalls, [
    {
      method: 'entries',
      employeeId: EMPLOYEE_ID,
      from: '2026-08-01',
      to: '2026-08-07',
    },
    {
      method: 'daily',
      employeeId: EMPLOYEE_ID,
      from: '2026-08-01',
      to: '2026-08-07',
    },
    {
      method: 'tasks',
      employeeId: EMPLOYEE_ID,
      from: '2026-08-01',
      to: '2026-08-07',
    },
  ]);
});

test('getMyHistory accepts an inclusive range at the configured maximum', async () => {
  const { service, historyCalls } = createService();

  await service.getMyHistory(EMPLOYEE_ID, {
    from: '2026-01-01',
    to: '2026-03-31',
  });

  assert.equal(MAX_TIMESHEET_HISTORY_RANGE_DAYS, 90);
  assert.equal(historyCalls.length, 3);
});

test('getMyHistory rejects incomplete, reversed, and excessive ranges before querying', async () => {
  const setup = createService();

  await assert.rejects(
    setup.service.getMyHistory(EMPLOYEE_ID, { from: '2026-08-01' }),
    /Both from and to dates are required/,
  );
  await assert.rejects(
    setup.service.getMyHistory(EMPLOYEE_ID, {
      from: '2026-08-08',
      to: '2026-08-07',
    }),
    /From date must be on or before to date/,
  );
  await assert.rejects(
    setup.service.getMyHistory(EMPLOYEE_ID, {
      from: '2026-01-01',
      to: '2026-04-01',
    }),
    /Date range cannot exceed 90 days/,
  );
  assert.deepEqual(setup.historyCalls, []);
});

test('getTaskEffortSource returns the grouped total and contributor projections', async () => {
  const entry = timesheetEntry({ hoursSpent: 7.5 });
  const setup = createService({
    effortTotal: 7.5,
    taskEffortEntries: [
      {
        entry,
        employee: { id: EMPLOYEE_ID, name: 'Alex Employee' },
      },
    ],
  });

  const result = await setup.service.getTaskEffortSource(TASK_ID);

  assert.equal(result.actualHours, 7.5);
  assert.equal(result.entries[0].hoursSpent, 7.5);
  assert.deepEqual(result.entries[0].employee, {
    id: EMPLOYEE_ID,
    name: 'Alex Employee',
  });
  assert.equal('submissionStatus' in result.entries[0], false);
  assert.deepEqual(setup.calls, ['task-totals', 'task-entries']);
});

test('getTaskEffortSource returns zero actual hours when a task has no entries', async () => {
  const result = await createService().service.getTaskEffortSource(TASK_ID);

  assert.equal(result.actualHours, 0);
  assert.deepEqual(result.entries, []);
});

test('getTeamTimesheets checks lead scope and returns joined entries in range', async () => {
  const entry = timesheetEntry();
  const setup = createService({
    teamEntries: [
      {
        entry,
        employee: { id: EMPLOYEE_ID, name: 'Alex Employee' },
        task: { id: TASK_ID, title: 'Implement effort totals' },
        goal: { id: 'goal-id', title: 'Track delivery' },
      },
    ],
  });
  const teamLead: AuthenticatedUser = {
    userId: 'team-lead-id',
    role: UserRole.TEAM_LEAD,
  };

  const result = await setup.service.getTeamTimesheets(
    TEAM_ID,
    { from: '2026-08-01', to: '2026-08-07' },
    teamLead,
  );

  assert.deepEqual(result.range, { from: '2026-08-01', to: '2026-08-07' });
  assert.deepEqual(result.entries[0].employee, {
    id: EMPLOYEE_ID,
    name: 'Alex Employee',
  });
  assert.equal(result.entries[0].task.title, 'Implement effort totals');
  assert.equal(result.entries[0].goal.title, 'Track delivery');
  assert.deepEqual(setup.calls, ['team-scope']);
  assert.deepEqual(setup.teamCalls, [
    { teamId: TEAM_ID, from: '2026-08-01', to: '2026-08-07' },
  ]);
});

test('getTeamTimesheets rejects another team before querying entries', async () => {
  const setup = createService({ teamLeadError: new ForbiddenError() });

  await assert.rejects(
    () =>
      setup.service.getTeamTimesheets(
        TEAM_ID,
        { from: '2026-08-01', to: '2026-08-07' },
        { userId: 'other-lead-id', role: UserRole.TEAM_LEAD },
      ),
    (error: unknown) => error instanceof ForbiddenError,
  );

  assert.deepEqual(setup.calls, ['team-scope']);
  assert.deepEqual(setup.teamCalls, []);
});
