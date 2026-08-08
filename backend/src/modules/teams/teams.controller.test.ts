import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ConflictError } from '../../common/errors';
import { requireAuth } from '../../common/middleware/authenticate';
import { errorHandler } from '../../common/middleware/error-handler';
import { UserRole } from '../users/users.entity';
import { createTeamsRouter } from './teams.controller';
import {
  CreateTeamDto,
  TeamDetailsProjection,
  TeamProjection,
  TeamsService,
} from './teams.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
let receivedCallerRole: UserRole | undefined;

function teamProjection(overrides: Partial<TeamProjection> = {}): TeamProjection {
  return {
    id: TEAM_ID,
    name: 'Platform',
    description: 'Builds the company platform.',
    leadId: null,
    weeklyCapacityHours: 40,
    createdAt: new Date('2026-08-08T08:00:00.000Z'),
    updatedAt: new Date('2026-08-08T08:00:00.000Z'),
    ...overrides,
  };
}

const teamsService = {
  async createTeam(dto: CreateTeamDto): Promise<TeamProjection> {
    if (dto.name === 'Existing') {
      throw new ConflictError('A team with this name already exists');
    }
    return teamProjection({
      name: dto.name,
      description: dto.description ?? '',
      weeklyCapacityHours: dto.weeklyCapacityHours ?? 40,
    });
  },
  async listTeams(caller: { role: UserRole }): Promise<TeamProjection[]> {
    receivedCallerRole = caller.role;
    return [teamProjection()];
  },
  async getTeamDetails(): Promise<TeamDetailsProjection> {
    return {
      ...teamProjection(),
      lead: null,
      members: [],
      memberCount: 0,
    };
  },
} as unknown as TeamsService;

const app = express();
app.use(express.json());
app.use('/teams', createTeamsRouter(teamsService, requireAuth(JWT_SECRET)));
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

function validTeamBody(name = 'Platform'): string {
  return JSON.stringify({
    name,
    description: 'Builds the company platform.',
    weeklyCapacityHours: 40,
  });
}

test('a Super Admin can create a team', async () => {
  const response = await fetch(`${baseUrl}/teams`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: validTeamBody(),
  });
  const body = (await response.json()) as { team: TeamProjection };

  assert.equal(response.status, 201);
  assert.equal(body.team.name, 'Platform');
  assert.equal(body.team.leadId, null);
});

for (const role of [UserRole.TEAM_LEAD, UserRole.EMPLOYEE]) {
  test(`${role} receives 403 from POST /teams`, async () => {
    const response = await fetch(`${baseUrl}/teams`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(role),
        'Content-Type': 'application/json',
      },
      body: validTeamBody(),
    });

    assert.equal(response.status, 403);
  });
}

test('POST /teams rejects a duplicate team name', async () => {
  const response = await fetch(`${baseUrl}/teams`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: validTeamBody('Existing'),
  });

  assert.equal(response.status, 409);
});

test('POST /teams validates name and weekly capacity', async () => {
  const response = await fetch(`${baseUrl}/teams`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: ' ', weeklyCapacityHours: 0 }),
  });

  assert.equal(response.status, 400);
});

for (const role of Object.values(UserRole)) {
  test(`GET /teams passes the ${role} caller to the service`, async () => {
    const response = await fetch(`${baseUrl}/teams`, {
      headers: authorizationHeader(role),
    });

    assert.equal(response.status, 200);
    assert.equal(receivedCallerRole, role);
  });
}

test('GET /teams/:id returns an empty team details state', async () => {
  const response = await fetch(`${baseUrl}/teams/${TEAM_ID}`, {
    headers: authorizationHeader(UserRole.TEAM_LEAD),
  });
  const body = (await response.json()) as { team: TeamDetailsProjection };

  assert.equal(response.status, 200);
  assert.equal(body.team.lead, null);
  assert.deepEqual(body.team.members, []);
  assert.equal(body.team.memberCount, 0);
});

test('GET /teams/:id rejects an invalid team id', async () => {
  const response = await fetch(`${baseUrl}/teams/not-a-uuid`, {
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });

  assert.equal(response.status, 400);
});
