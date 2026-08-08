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
import {
  createAllocationRouter,
  createCompanyAllocationRouter,
} from './allocation.controller';
import {
  AllocationService,
  CompanySummaryFilter,
  CompanySummaryResult,
  TeamSummaryRange,
  TeamSummaryResult,
} from './allocation.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const OTHER_TEAM_ID = '11111111-1111-4111-8111-111111111111';

let receivedRange: TeamSummaryRange | undefined;
let receivedCallerRole: UserRole | undefined;
let receivedCompanyFilter: CompanySummaryFilter | undefined;

const allocationService = {
  async getTeamSummary(
    teamId: string,
    range: TeamSummaryRange,
    caller: { role: UserRole },
  ): Promise<TeamSummaryResult> {
    if (teamId === OTHER_TEAM_ID) throw new ForbiddenError();
    if (range.from > range.to) {
      throw new ValidationError('From date must be on or before to date');
    }
    receivedRange = range;
    receivedCallerRole = caller.role;
    return {
      range,
      kpis: {
        activeGoals: 1,
        totalTasks: 3,
        completedTasks: 1,
        blockedTasks: 1,
        overdueTasks: 1,
      },
      employees: [
        {
          employeeId: 'employee-id',
          employeeName: 'Alex',
          weeklyCapacityHours: 40,
          activeTaskCount: 2,
          estimatedHoursOnActiveTasks: 42,
          recordedHours: 30,
          utilisation: 105,
          workload: 'OVERLOADED',
        },
      ],
      activeGoals: [],
    };
  },
  async getCompanySummary(
    filter: CompanySummaryFilter,
    caller: { role: UserRole },
  ): Promise<CompanySummaryResult> {
    if (filter.from && filter.to && filter.from > filter.to) {
      throw new ValidationError('From date must be on or before to date');
    }
    receivedCompanyFilter = filter;
    receivedCallerRole = caller.role;
    return {
      range: {
        from: filter.from ?? '2026-08-03',
        to: filter.to ?? '2026-08-09',
      },
      filters: { teamId: filter.teamId, goalId: filter.goalId },
      kpis: {
        totalTeams: 1,
        totalEmployees: 1,
        activeGoals: 1,
        totalTasks: 2,
        overdueTasks: 1,
      },
      teams: [
        {
          teamId: TEAM_ID,
          teamName: 'Platform',
          memberCount: 1,
          activeGoals: 1,
          totalTasks: 2,
          overdueTasks: 1,
          averageUtilisation: 105,
          overloadedMemberCount: 1,
          availableMemberCount: 0,
        },
      ],
      employees: [
        {
          teamId: TEAM_ID,
          teamName: 'Platform',
          employeeId: 'employee-id',
          employeeName: 'Alex',
          weeklyCapacityHours: 40,
          activeTaskCount: 2,
          estimatedHoursOnActiveTasks: 42,
          recordedHours: 30,
          utilisation: 105,
          workload: 'OVERLOADED',
        },
      ],
    };
  },
} as AllocationService;

const app = express();
app.use('/teams', createAllocationRouter(allocationService, requireAuth(JWT_SECRET)));
app.use('/company', createCompanyAllocationRouter(allocationService, requireAuth(JWT_SECRET)));
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
  const token = jwt.sign({ userId: `${role.toLowerCase()}-id`, role }, JWT_SECRET, {
    expiresIn: '24h',
  });
  return { Authorization: `Bearer ${token}` };
}

test('GET /teams/:teamId/summary returns the complete Team Lead dashboard response', async () => {
  const response = await fetch(
    `${baseUrl}/teams/${TEAM_ID}/summary?from=2026-08-01&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.TEAM_LEAD) },
  );
  const body = (await response.json()) as TeamSummaryResult;

  assert.equal(response.status, 200);
  assert.deepEqual(receivedRange, { from: '2026-08-01', to: '2026-08-07' });
  assert.equal(receivedCallerRole, UserRole.TEAM_LEAD);
  assert.equal(body.kpis.activeGoals, 1);
  assert.equal(body.employees[0].workload, 'OVERLOADED');
  assert.deepEqual(body.activeGoals, []);
});

test('GET /teams/:teamId/summary allows a Super Admin caller', async () => {
  const response = await fetch(
    `${baseUrl}/teams/${TEAM_ID}/summary?from=2026-08-01&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.SUPER_ADMIN) },
  );

  assert.equal(response.status, 200);
  assert.equal(receivedCallerRole, UserRole.SUPER_ADMIN);
});

test('GET /teams/:teamId/summary returns 403 for another team', async () => {
  const response = await fetch(
    `${baseUrl}/teams/${OTHER_TEAM_ID}/summary?from=2026-08-01&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.TEAM_LEAD) },
  );

  assert.equal(response.status, 403);
});

test('GET /teams/:teamId/summary requires authentication and a dashboard role', async () => {
  const unauthenticatedResponse = await fetch(
    `${baseUrl}/teams/${TEAM_ID}/summary?from=2026-08-01&to=2026-08-07`,
  );
  const employeeResponse = await fetch(
    `${baseUrl}/teams/${TEAM_ID}/summary?from=2026-08-01&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.EMPLOYEE) },
  );

  assert.equal(unauthenticatedResponse.status, 401);
  assert.equal(employeeResponse.status, 403);
});

test('GET /teams/:teamId/summary validates identifiers and complete date ranges', async () => {
  for (const path of [
    '/teams/not-a-uuid/summary?from=2026-08-01&to=2026-08-07',
    `/teams/${TEAM_ID}/summary`,
    `/teams/${TEAM_ID}/summary?from=2026-08-01`,
    `/teams/${TEAM_ID}/summary?from=2026-02-30&to=2026-03-01`,
    `/teams/${TEAM_ID}/summary?from=2026-08-01&to=2026-08-07&unexpected=true`,
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: authorizationHeader(UserRole.TEAM_LEAD),
    });
    assert.equal(response.status, 400);
  }
});

test('GET /teams/:teamId/summary returns a clear error for a reversed range', async () => {
  const response = await fetch(
    `${baseUrl}/teams/${TEAM_ID}/summary?from=2026-08-08&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.TEAM_LEAD) },
  );
  const body = (await response.json()) as { error: { message: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.message, 'From date must be on or before to date');
});

test('GET /company/summary returns the company dashboard response and composed filters', async () => {
  const goalId = '756aefc5-fc71-4570-b730-f6677a18ac83';
  const response = await fetch(
    `${baseUrl}/company/summary?from=2026-08-01&to=2026-08-07&teamId=${TEAM_ID}&goalId=${goalId}`,
    { headers: authorizationHeader(UserRole.SUPER_ADMIN) },
  );
  const body = (await response.json()) as CompanySummaryResult;

  assert.equal(response.status, 200);
  assert.deepEqual(receivedCompanyFilter, {
    from: '2026-08-01',
    to: '2026-08-07',
    teamId: TEAM_ID,
    goalId,
  });
  assert.equal(receivedCallerRole, UserRole.SUPER_ADMIN);
  assert.equal(body.kpis.totalEmployees, 1);
  assert.equal(body.teams[0].overloadedMemberCount, 1);
  assert.equal(body.employees[0].teamName, 'Platform');
});

test('GET /company/summary accepts an omitted range for the service default', async () => {
  const response = await fetch(`${baseUrl}/company/summary`, {
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(receivedCompanyFilter, {});
});

test('GET /company/summary requires authentication and the Super Admin role', async () => {
  const unauthenticatedResponse = await fetch(`${baseUrl}/company/summary`);
  const teamLeadResponse = await fetch(`${baseUrl}/company/summary`, {
    headers: authorizationHeader(UserRole.TEAM_LEAD),
  });
  const employeeResponse = await fetch(`${baseUrl}/company/summary`, {
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });

  assert.equal(unauthenticatedResponse.status, 401);
  assert.equal(teamLeadResponse.status, 403);
  assert.equal(employeeResponse.status, 403);
});

test('GET /company/summary validates optional identifiers and paired date filters', async () => {
  for (const path of [
    '/company/summary?from=2026-08-01',
    '/company/summary?to=2026-08-07',
    '/company/summary?from=2026-02-30&to=2026-03-01',
    '/company/summary?teamId=not-a-uuid',
    '/company/summary?goalId=not-a-uuid',
    '/company/summary?unexpected=true',
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: authorizationHeader(UserRole.SUPER_ADMIN),
    });
    assert.equal(response.status, 400);
  }
});

test('GET /company/summary returns a clear error for a reversed range', async () => {
  const response = await fetch(
    `${baseUrl}/company/summary?from=2026-08-08&to=2026-08-07`,
    { headers: authorizationHeader(UserRole.SUPER_ADMIN) },
  );
  const body = (await response.json()) as { error: { message: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.message, 'From date must be on or before to date');
});
