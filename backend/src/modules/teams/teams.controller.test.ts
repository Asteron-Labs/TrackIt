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
  TeamMemberProjection,
  TeamProjection,
  TeamsService,
} from './teams.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const USER_ID = '2a32a99d-5ae1-485f-9bed-bd3470eabf46';
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

function memberProjection(role = UserRole.EMPLOYEE): TeamMemberProjection {
  return {
    id: USER_ID,
    name: 'Asha Perera',
    email: 'asha@example.com',
    role,
    teamId: TEAM_ID,
    joinedAt: new Date('2026-08-08T08:00:00.000Z'),
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
  async addMember(): Promise<TeamMemberProjection> {
    return memberProjection();
  },
  async removeMember(_teamId: string, userId: string): Promise<void> {
    if (userId === '11111111-1111-4111-8111-111111111111') {
      throw new ConflictError('Reassign the team lead before removing this member');
    }
  },
  async assignTeamLead(): Promise<TeamMemberProjection> {
    return memberProjection(UserRole.TEAM_LEAD);
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

test('a Super Admin can add an employee to a team', async () => {
  const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/members`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  const body = (await response.json()) as { member: TeamMemberProjection };

  assert.equal(response.status, 201);
  assert.equal(body.member.id, USER_ID);
});

test('a Super Admin can assign a current member as team lead', async () => {
  const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/lead`, {
    method: 'PUT',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  const body = (await response.json()) as { lead: TeamMemberProjection };

  assert.equal(response.status, 200);
  assert.equal(body.lead.role, UserRole.TEAM_LEAD);
});

test('a Super Admin can remove an ordinary member', async () => {
  const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/members/${USER_ID}`, {
    method: 'DELETE',
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });

  assert.equal(response.status, 204);
});

test('removing the current lead returns the service conflict clearly', async () => {
  const leadId = '11111111-1111-4111-8111-111111111111';
  const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/members/${leadId}`, {
    method: 'DELETE',
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });
  const body = (await response.json()) as { error: { message: string } };

  assert.equal(response.status, 409);
  assert.equal(body.error.message, 'Reassign the team lead before removing this member');
});

for (const role of [UserRole.TEAM_LEAD, UserRole.EMPLOYEE]) {
  test(`${role} cannot manage team membership or leadership`, async () => {
    const headers = {
      ...authorizationHeader(role),
      'Content-Type': 'application/json',
    };
    const responses = await Promise.all([
      fetch(`${baseUrl}/teams/${TEAM_ID}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: USER_ID }),
      }),
      fetch(`${baseUrl}/teams/${TEAM_ID}/lead`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ userId: USER_ID }),
      }),
      fetch(`${baseUrl}/teams/${TEAM_ID}/members/${USER_ID}`, {
        method: 'DELETE',
        headers,
      }),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [403, 403, 403],
    );
  });
}

test('team management routes validate user ids', async () => {
  const response = await fetch(`${baseUrl}/teams/${TEAM_ID}/members`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: 'not-a-uuid' }),
  });

  assert.equal(response.status, 400);
});
