import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { requireAuth } from '../../common/middleware/authenticate';
import { errorHandler } from '../../common/middleware/error-handler';
import { UserRole } from '../users/users.entity';
import { createGoalsRouter } from './goals.controller';
import { GoalImportance, GoalStatus } from './goals.entity';
import { GoalFilter } from './goals.repository';
import { CreateGoalDto, GoalProjection, GoalService, UpdateGoalDto } from './goals.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const GOAL_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';
const MISSING_GOAL_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const OTHER_TEAM_ID = '22222222-2222-4222-8222-222222222222';
let receivedFilter: GoalFilter | undefined;

function goalProjection(overrides: Partial<GoalProjection> = {}): GoalProjection {
  return {
    id: GOAL_ID,
    teamId: TEAM_ID,
    title: 'Release TrackIt',
    description: 'Prepare the first release.',
    startDate: '2026-08-10',
    deadline: '2026-09-10',
    status: GoalStatus.PLANNED,
    importance: GoalImportance.HIGH,
    createdById: 'creator-id',
    progress: null,
    createdAt: new Date('2026-08-08T08:00:00.000Z'),
    updatedAt: new Date('2026-08-08T08:00:00.000Z'),
    ...overrides,
  };
}

const goalService = {
  async createGoal(dto: CreateGoalDto): Promise<GoalProjection> {
    if (dto.teamId === OTHER_TEAM_ID) {
      throw new ForbiddenError();
    }
    if (dto.deadline <= dto.startDate) {
      throw new ValidationError('Deadline must fall after the start date');
    }
    return goalProjection({
      teamId: dto.teamId,
      title: dto.title,
      description: dto.description ?? '',
      startDate: dto.startDate,
      deadline: dto.deadline,
      importance: dto.importance,
    });
  },
  async listTeamGoals(_teamId: string, filter: GoalFilter): Promise<GoalProjection[]> {
    receivedFilter = filter;
    return [goalProjection({ status: filter.status ?? GoalStatus.PLANNED })];
  },
  async getGoal(goalId: string): Promise<GoalProjection> {
    if (goalId === MISSING_GOAL_ID) {
      throw new NotFoundError('Goal not found');
    }
    return goalProjection();
  },
  async updateGoal(_goalId: string, dto: UpdateGoalDto): Promise<GoalProjection> {
    return goalProjection(dto);
  },
} as unknown as GoalService;

const app = express();
app.use(express.json());
app.use(createGoalsRouter(goalService, requireAuth(JWT_SECRET)));
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

function validGoalBody(teamId = TEAM_ID): string {
  return JSON.stringify({
    teamId,
    title: 'Release TrackIt',
    description: 'Prepare the first release.',
    startDate: '2026-08-10',
    deadline: '2026-09-10',
    importance: GoalImportance.HIGH,
  });
}

for (const role of [UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD]) {
  test(`${role} can create a goal`, async () => {
    const response = await fetch(`${baseUrl}/goals`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(role),
        'Content-Type': 'application/json',
      },
      body: validGoalBody(),
    });
    const body = (await response.json()) as { goal: GoalProjection };

    assert.equal(response.status, 201);
    assert.equal(body.goal.status, GoalStatus.PLANNED);
    assert.equal(body.goal.progress, null);
  });
}

test('an Employee cannot create a goal', async () => {
  const response = await fetch(`${baseUrl}/goals`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: validGoalBody(),
  });

  assert.equal(response.status, 403);
});

test('a Team Lead receives 403 when creating a goal for another team', async () => {
  const response = await fetch(`${baseUrl}/goals`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: validGoalBody(OTHER_TEAM_ID),
  });

  assert.equal(response.status, 403);
});

test('POST /goals rejects a deadline before the start date', async () => {
  const response = await fetch(`${baseUrl}/goals`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teamId: TEAM_ID,
      title: 'Release TrackIt',
      startDate: '2026-09-10',
      deadline: '2026-09-01',
      importance: GoalImportance.HIGH,
    }),
  });

  assert.equal(response.status, 400);
});

test('POST /goals validates date-only values and required fields', async () => {
  const response = await fetch(`${baseUrl}/goals`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teamId: TEAM_ID,
      title: ' ',
      startDate: '2026-02-30',
      deadline: 'not-a-date',
      importance: 'URGENT',
    }),
  });

  assert.equal(response.status, 400);
});

for (const role of Object.values(UserRole)) {
  test(`${role} can list visible team goals`, async () => {
    const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/goals?status=${GoalStatus.ACTIVE}`, {
      headers: authorizationHeader(role),
    });
    const body = (await response.json()) as { goals: GoalProjection[] };

    assert.equal(response.status, 200);
    assert.deepEqual(receivedFilter, { status: GoalStatus.ACTIVE });
    assert.equal(body.goals[0].status, GoalStatus.ACTIVE);
    assert.equal(body.goals[0].deadline, '2026-09-10');
  });
}

test('GET /teams/:teamId/goals validates the status filter', async () => {
  const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/goals?status=UNKNOWN`, {
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });

  assert.equal(response.status, 400);
});

test('GET /goals/:id returns goal details', async () => {
  const response = await fetch(`${baseUrl}/goals/${GOAL_ID}`, {
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });
  const body = (await response.json()) as { goal: GoalProjection };

  assert.equal(response.status, 200);
  assert.equal(body.goal.id, GOAL_ID);
});

test('GET /goals/:id returns the service not-found error', async () => {
  const response = await fetch(`${baseUrl}/goals/${MISSING_GOAL_ID}`, {
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });

  assert.equal(response.status, 404);
});

test('an authorized manager can update goal status', async () => {
  const response = await fetch(`${baseUrl}/goals/${GOAL_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: GoalStatus.ACTIVE }),
  });
  const body = (await response.json()) as { goal: GoalProjection };

  assert.equal(response.status, 200);
  assert.equal(body.goal.status, GoalStatus.ACTIVE);
});

test('PATCH /goals/:id rejects an empty body and Employee callers', async () => {
  const teamLeadResponse = await fetch(`${baseUrl}/goals/${GOAL_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const employeeResponse = await fetch(`${baseUrl}/goals/${GOAL_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: GoalStatus.ACTIVE }),
  });

  assert.equal(teamLeadResponse.status, 400);
  assert.equal(employeeResponse.status, 403);
});

test('goal routes require authentication', async () => {
  const response = await fetch(`${baseUrl}/goals/${GOAL_ID}`);

  assert.equal(response.status, 401);
});
