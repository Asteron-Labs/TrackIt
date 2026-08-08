import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ConflictError } from '../../common/errors';
import { errorHandler } from '../../common/middleware/error-handler';
import { requireAuth } from '../../common/middleware/authenticate';
import { UserFilter } from './users.repository';
import { createUsersRouter } from './users.controller';
import { UserRole } from './users.entity';
import { CreateUserDto, UserProjection, UsersService } from './users.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
let receivedFilter: UserFilter | undefined;

const usersService = {
  async createUser(dto: CreateUserDto): Promise<UserProjection> {
    if (dto.email === 'existing@example.com') {
      throw new ConflictError('A user with this email already exists');
    }

    return {
      id: '452bc477-9510-4d32-a9f4-64b984affd78',
      name: dto.name,
      email: dto.email,
      role: dto.role,
      teamId: null,
    };
  },
  async listUsers(filter: UserFilter): Promise<UserProjection[]> {
    receivedFilter = filter;
    return [
      {
        id: '452bc477-9510-4d32-a9f4-64b984affd78',
        name: 'Asha Perera',
        email: 'asha@example.com',
        role: UserRole.EMPLOYEE,
        teamId: null,
      },
    ];
  },
} as unknown as UsersService;

const app = express();
app.use(express.json());
app.use('/users', createUsersRouter(usersService, requireAuth(JWT_SECRET)));
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

function validUserBody(role: UserRole): string {
  return JSON.stringify({
    name: `${role} User`,
    email: `${role.toLowerCase()}@example.com`,
    password: 'safe-password',
    role,
  });
}

for (const callerRole of [UserRole.TEAM_LEAD, UserRole.EMPLOYEE]) {
  test(`${callerRole} receives 403 from POST /users`, async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(callerRole),
        'Content-Type': 'application/json',
      },
      body: validUserBody(UserRole.EMPLOYEE),
    });

    assert.equal(response.status, 403);
  });

  test(`${callerRole} receives 403 from GET /users`, async () => {
    const response = await fetch(`${baseUrl}/users`, {
      headers: authorizationHeader(callerRole),
    });

    assert.equal(response.status, 403);
  });
}

for (const createdRole of Object.values(UserRole)) {
  test(`a Super Admin can create a ${createdRole} user`, async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(UserRole.SUPER_ADMIN),
        'Content-Type': 'application/json',
      },
      body: validUserBody(createdRole),
    });
    const body = (await response.json()) as { user: UserProjection };

    assert.equal(response.status, 201);
    assert.equal(body.user.role, createdRole);
    assert.equal('passwordHash' in body.user, false);
  });
}

test('POST /users enforces the four-character password minimum', async () => {
  const response = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Asha Perera',
      email: 'asha@example.com',
      password: '123',
      role: UserRole.EMPLOYEE,
    }),
  });

  assert.equal(response.status, 400);
});

test('GET /users passes role and unassigned filters to the service', async () => {
  const response = await fetch(`${baseUrl}/users?role=EMPLOYEE&unassigned=true`, {
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(receivedFilter, { role: UserRole.EMPLOYEE, unassigned: true });
});

test('POST /users returns a clear conflict for a duplicate email', async () => {
  const response = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Existing User',
      email: 'existing@example.com',
      password: 'safe-password',
      role: UserRole.EMPLOYEE,
    }),
  });
  const body = (await response.json()) as { error: { message: string } };

  assert.equal(response.status, 409);
  assert.equal(body.error.message, 'A user with this email already exists');
});
