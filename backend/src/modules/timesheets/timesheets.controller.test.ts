import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenError, ValidationError } from '../../common/errors';
import { requireAuth } from '../../common/middleware/authenticate';
import { errorHandler } from '../../common/middleware/error-handler';
import { UserRole } from '../users/users.entity';
import { createTeamTimesheetsRouter, createTimesheetsRouter } from './timesheets.controller';
import {
  LogTimeDto,
  LogTimeResult,
  TimesheetHistoryRangeInput,
  TimesheetHistoryResult,
  TimesheetService,
  TeamTimesheetResult,
  UpdateTimeEntryDto,
  UpdateTimeEntryResult,
} from './timesheets.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const EMPLOYEE_ID = '2894b41a-d903-421b-8cbb-4dbd48c836ab';
const TASK_ID = 'ce379e12-9464-4f42-9f04-19e04be1b4d1';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const OTHER_TEAM_ID = '11111111-1111-4111-8111-111111111111';
const FORBIDDEN_TASK_ID = '33333333-3333-4333-8333-333333333333';
const LIMIT_TASK_ID = '44444444-4444-4444-8444-444444444444';
const ENTRY_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';
const OTHER_ENTRY_ID = '55555555-5555-4555-8555-555555555555';

const timesheetService = {
  async getTeamTimesheets(
    teamId: string,
    range: TimesheetHistoryRangeInput,
  ): Promise<TeamTimesheetResult> {
    if (teamId === OTHER_TEAM_ID) throw new ForbiddenError();
    const resolvedRange =
      range.from && range.to
        ? { from: range.from, to: range.to }
        : { from: '2026-08-03', to: '2026-08-09' };
    return {
      range: resolvedRange,
      entries: [
        {
          id: ENTRY_ID,
          employeeId: EMPLOYEE_ID,
          taskId: TASK_ID,
          workDate: resolvedRange.to,
          hoursSpent: 2,
          workNote: 'Implemented team view',
          createdAt: new Date('2026-08-07T08:00:00.000Z'),
          updatedAt: new Date('2026-08-07T08:00:00.000Z'),
          employee: { id: EMPLOYEE_ID, name: 'Alex Employee' },
          task: { id: TASK_ID, title: 'Implement team view' },
          goal: { id: 'goal-id', title: 'Track effort' },
        },
      ],
    };
  },
  async getMyHistory(
    callerId: string,
    range: TimesheetHistoryRangeInput,
  ): Promise<TimesheetHistoryResult> {
    const resolvedRange =
      range.from && range.to ? { from: range.from, to: range.to } : { from: '2026-08-03', to: '2026-08-09' };
    if (resolvedRange.from > resolvedRange.to) {
      throw new ValidationError('From date must be on or before to date');
    }

    return {
      range: resolvedRange,
      entries: [
        {
          id: ENTRY_ID,
          employeeId: callerId,
          taskId: TASK_ID,
          workDate: resolvedRange.to,
          hoursSpent: 2,
          workNote: 'Implemented history',
          createdAt: new Date('2026-08-07T08:00:00.000Z'),
          updatedAt: new Date('2026-08-07T08:00:00.000Z'),
          task: { id: TASK_ID, title: 'Implement history' },
          goal: { id: 'goal-id', title: 'Track effort' },
        },
      ],
      dailyTotals: [{ workDate: resolvedRange.to, totalHours: 2 }],
      taskTotals: [{ taskId: TASK_ID, taskTitle: 'Implement history', totalHours: 2 }],
    };
  },
  async logTime(dto: LogTimeDto): Promise<LogTimeResult> {
    if (dto.taskId === FORBIDDEN_TASK_ID) throw new ForbiddenError();
    if (dto.taskId === LIMIT_TASK_ID) {
      throw new ValidationError('Daily total cannot exceed 12 hours');
    }
    return {
      timesheetEntry: {
        id: ENTRY_ID,
        employeeId: EMPLOYEE_ID,
        taskId: dto.taskId,
        workDate: dto.workDate,
        hoursSpent: dto.hoursSpent,
        workNote: dto.workNote ?? '',
        createdAt: new Date('2026-08-07T08:00:00.000Z'),
        updatedAt: new Date('2026-08-07T08:00:00.000Z'),
      },
      dailyTotalHours: 5,
      created: dto.workNote !== 'add',
    };
  },
  async updateEntry(
    entryId: string,
    dto: UpdateTimeEntryDto,
  ): Promise<UpdateTimeEntryResult> {
    if (entryId === OTHER_ENTRY_ID) throw new ForbiddenError();
    return {
      timesheetEntry: {
        id: entryId,
        employeeId: EMPLOYEE_ID,
        taskId: TASK_ID,
        workDate: '2026-08-07',
        hoursSpent: dto.hoursSpent ?? 2,
        workNote: dto.workNote ?? 'Morning work',
        createdAt: new Date('2026-08-07T08:00:00.000Z'),
        updatedAt: new Date('2026-08-07T09:00:00.000Z'),
      },
      dailyTotalHours: 5,
    };
  },
  async deleteEntry(entryId: string): Promise<void> {
    if (entryId === OTHER_ENTRY_ID) throw new ForbiddenError();
  },
} as unknown as TimesheetService;

const app = express();
app.use(express.json());
app.use('/teams', createTeamTimesheetsRouter(timesheetService, requireAuth(JWT_SECRET)));
app.use('/timesheets', createTimesheetsRouter(timesheetService, requireAuth(JWT_SECRET)));
app.use(errorHandler);

let server: Server;
let baseUrl: string;

before(
  () =>
    new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    }),
);

after(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
);

function authorizationHeader(role: UserRole): { Authorization: string } {
  const userId = role === UserRole.EMPLOYEE ? EMPLOYEE_ID : `${role.toLowerCase()}-id`;
  const token = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '24h' });
  return { Authorization: `Bearer ${token}` };
}

function validBody(taskId = TASK_ID, workNote = 'Implemented time logging'): string {
  return JSON.stringify({
    taskId,
    workDate: '2026-08-07',
    hoursSpent: 2,
    workNote,
  });
}

test('GET /teams/:teamId/timesheets returns the Team Leads filtered entries', async () => {
  const response = await fetch(
    `${baseUrl}/teams/${TEAM_ID}/timesheets?from=2026-08-01&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.TEAM_LEAD) },
  );
  const body = (await response.json()) as TeamTimesheetResult;

  assert.equal(response.status, 200);
  assert.deepEqual(body.range, { from: '2026-08-01', to: '2026-08-07' });
  assert.equal(body.entries[0].employee.name, 'Alex Employee');
  assert.equal(body.entries[0].task.title, 'Implement team view');
  assert.equal(body.entries[0].goal.title, 'Track effort');
});

test('GET /teams/:teamId/timesheets returns 403 for another team', async () => {
  const response = await fetch(`${baseUrl}/teams/${OTHER_TEAM_ID}/timesheets`, {
    headers: authorizationHeader(UserRole.TEAM_LEAD),
  });

  assert.equal(response.status, 403);
});

test('GET /teams/:teamId/timesheets requires the Team Lead role and authentication', async () => {
  for (const role of [UserRole.SUPER_ADMIN, UserRole.EMPLOYEE]) {
    const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/timesheets`, {
      headers: authorizationHeader(role),
    });
    assert.equal(response.status, 403);
  }

  const unauthenticatedResponse = await fetch(`${baseUrl}/teams/${TEAM_ID}/timesheets`);
  assert.equal(unauthenticatedResponse.status, 401);
});

test('GET /teams/:teamId/timesheets validates identifiers and paired date filters', async () => {
  for (const path of [
    '/teams/not-a-uuid/timesheets',
    `/teams/${TEAM_ID}/timesheets?from=2026-08-01`,
    `/teams/${TEAM_ID}/timesheets?from=2026-02-30&to=2026-03-01`,
    `/teams/${TEAM_ID}/timesheets?from=2026-08-01&to=2026-08-07&unexpected=true`,
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: authorizationHeader(UserRole.TEAM_LEAD),
    });
    assert.equal(response.status, 400);
  }
});

test('GET /timesheets/mine returns an Employees bounded history and rollups', async () => {
  const response = await fetch(
    `${baseUrl}/timesheets/mine?from=2026-08-01&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.EMPLOYEE) },
  );
  const body = (await response.json()) as TimesheetHistoryResult;

  assert.equal(response.status, 200);
  assert.deepEqual(body.range, { from: '2026-08-01', to: '2026-08-07' });
  assert.equal(body.entries[0].employeeId, EMPLOYEE_ID);
  assert.equal(body.entries[0].workDate, '2026-08-07');
  assert.equal(body.entries[0].task.title, 'Implement history');
  assert.equal(body.entries[0].goal.title, 'Track effort');
  assert.deepEqual(body.dailyTotals, [{ workDate: '2026-08-07', totalHours: 2 }]);
  assert.deepEqual(body.taskTotals, [
    { taskId: TASK_ID, taskTitle: 'Implement history', totalHours: 2 },
  ]);
});

test('GET /timesheets/mine allows an omitted range for the default week', async () => {
  const response = await fetch(`${baseUrl}/timesheets/mine`, {
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });
  const body = (await response.json()) as TimesheetHistoryResult;

  assert.equal(response.status, 200);
  assert.deepEqual(body.range, { from: '2026-08-03', to: '2026-08-09' });
});

test('GET /timesheets/mine requires authentication and the Employee role', async () => {
  const unauthenticatedResponse = await fetch(`${baseUrl}/timesheets/mine`);
  assert.equal(unauthenticatedResponse.status, 401);

  for (const role of [UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD]) {
    const response = await fetch(`${baseUrl}/timesheets/mine`, {
      headers: authorizationHeader(role),
    });
    assert.equal(response.status, 403);
  }
});

test('GET /timesheets/mine validates dates and requires both range endpoints', async () => {
  for (const query of [
    'from=2026-08-01',
    'to=2026-08-07',
    'from=2026-02-30&to=2026-03-01',
    'from=not-a-date&to=2026-08-07',
    'from=2026-08-01&to=2026-08-07&unexpected=true',
  ]) {
    const response = await fetch(`${baseUrl}/timesheets/mine?${query}`, {
      headers: authorizationHeader(UserRole.EMPLOYEE),
    });
    assert.equal(response.status, 400);
  }
});

test('GET /timesheets/mine returns a clear error for a reversed range', async () => {
  const response = await fetch(
    `${baseUrl}/timesheets/mine?from=2026-08-08&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.EMPLOYEE) },
  );
  const body = (await response.json()) as { error: { message: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.message, 'From date must be on or before to date');
});

test('POST /timesheets creates time for an Employee', async () => {
  const response = await fetch(`${baseUrl}/timesheets`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: validBody(),
  });
  const body = (await response.json()) as {
    timesheetEntry: { taskId: string; submissionStatus?: string };
    dailyTotalHours: number;
  };

  assert.equal(response.status, 201);
  assert.equal(body.timesheetEntry.taskId, TASK_ID);
  assert.equal(body.timesheetEntry.submissionStatus, undefined);
  assert.equal(body.dailyTotalHours, 5);
});

test('POST /timesheets returns 200 when adding to an existing entry', async () => {
  const response = await fetch(`${baseUrl}/timesheets`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: validBody(TASK_ID, 'add'),
  });

  assert.equal(response.status, 200);
});

for (const role of [UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD]) {
  test(`POST /timesheets rejects ${role}`, async () => {
    const response = await fetch(`${baseUrl}/timesheets`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(role),
        'Content-Type': 'application/json',
      },
      body: validBody(),
    });

    assert.equal(response.status, 403);
  });
}

test('POST /timesheets requires authentication', async () => {
  const response = await fetch(`${baseUrl}/timesheets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: validBody(),
  });

  assert.equal(response.status, 401);
});

test('POST /timesheets validates UUIDs, dates, numeric hours, and extra fields', async () => {
  for (const body of [
    { taskId: 'not-a-uuid', workDate: '2026-08-07', hoursSpent: 2 },
    { taskId: TASK_ID, workDate: '2026-02-30', hoursSpent: 2 },
    { taskId: TASK_ID, workDate: '2026-08-07', hoursSpent: 'two' },
    { taskId: TASK_ID, workDate: '2026-08-07', hoursSpent: 2, unexpected: true },
  ]) {
    const response = await fetch(`${baseUrl}/timesheets`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(UserRole.EMPLOYEE),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    assert.equal(response.status, 400);
  }
});

test('POST /timesheets returns service authorization and daily-limit errors', async () => {
  const forbiddenResponse = await fetch(`${baseUrl}/timesheets`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: validBody(FORBIDDEN_TASK_ID),
  });
  const limitResponse = await fetch(`${baseUrl}/timesheets`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: validBody(LIMIT_TASK_ID),
  });

  assert.equal(forbiddenResponse.status, 403);
  assert.equal(limitResponse.status, 400);
});

test('PATCH /timesheets/:id updates an Employees entry', async () => {
  const response = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hoursSpent: 3, workNote: 'Corrected work' }),
  });
  const body = (await response.json()) as {
    timesheetEntry: { id: string; hoursSpent: number; workNote: string };
    dailyTotalHours: number;
  };

  assert.equal(response.status, 200);
  assert.equal(body.timesheetEntry.id, ENTRY_ID);
  assert.equal(body.timesheetEntry.hoursSpent, 3);
  assert.equal(body.timesheetEntry.workNote, 'Corrected work');
  assert.equal(body.dailyTotalHours, 5);
});

test('PATCH /timesheets/:id accepts a partial update and rejects invalid bodies', async () => {
  const partialResponse = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workNote: '' }),
  });
  assert.equal(partialResponse.status, 200);

  for (const body of [
    {},
    { hoursSpent: 'three' },
    { hoursSpent: 3, taskId: TASK_ID },
  ]) {
    const response = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
      method: 'PATCH',
      headers: {
        ...authorizationHeader(UserRole.EMPLOYEE),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    assert.equal(response.status, 400);
  }

  const invalidIdResponse = await fetch(`${baseUrl}/timesheets/not-a-uuid`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hoursSpent: 3 }),
  });
  assert.equal(invalidIdResponse.status, 400);
});

test('PATCH and DELETE return 403 for another employees entry', async () => {
  const patchResponse = await fetch(`${baseUrl}/timesheets/${OTHER_ENTRY_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hoursSpent: 3 }),
  });
  const deleteResponse = await fetch(`${baseUrl}/timesheets/${OTHER_ENTRY_ID}`, {
    method: 'DELETE',
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });

  assert.equal(patchResponse.status, 403);
  assert.equal(deleteResponse.status, 403);
});

test('DELETE /timesheets/:id deletes an Employees entry', async () => {
  const response = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
    method: 'DELETE',
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
});

for (const role of [UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD]) {
  test(`PATCH and DELETE /timesheets/:id reject ${role}`, async () => {
    const patchResponse = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
      method: 'PATCH',
      headers: {
        ...authorizationHeader(role),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hoursSpent: 3 }),
    });
    const deleteResponse = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
      method: 'DELETE',
      headers: authorizationHeader(role),
    });

    assert.equal(patchResponse.status, 403);
    assert.equal(deleteResponse.status, 403);
  });
}

test('PATCH and DELETE /timesheets/:id require authentication', async () => {
  const patchResponse = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hoursSpent: 3 }),
  });
  const deleteResponse = await fetch(`${baseUrl}/timesheets/${ENTRY_ID}`, {
    method: 'DELETE',
  });

  assert.equal(patchResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
});
