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
import { createTimesheetsRouter } from './timesheets.controller';
import { LogTimeDto, LogTimeResult, TimesheetService } from './timesheets.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const EMPLOYEE_ID = '2894b41a-d903-421b-8cbb-4dbd48c836ab';
const TASK_ID = 'ce379e12-9464-4f42-9f04-19e04be1b4d1';
const FORBIDDEN_TASK_ID = '33333333-3333-4333-8333-333333333333';
const LIMIT_TASK_ID = '44444444-4444-4444-8444-444444444444';
const ENTRY_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';

const timesheetService = {
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
} as unknown as TimesheetService;

const app = express();
app.use(express.json());
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
