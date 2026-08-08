import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server } from 'node:http';
import { UserRole } from '../../modules/users/users.entity';
import { errorHandler } from './error-handler';
import { requireAuth } from './authenticate';
import { requireRole } from './authorize';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const app = express();
const routesByRole: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/super-admin',
  [UserRole.TEAM_LEAD]: '/team-lead',
  [UserRole.EMPLOYEE]: '/employee',
};
const deniedRouteByRole: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/employee',
  [UserRole.TEAM_LEAD]: '/super-admin',
  [UserRole.EMPLOYEE]: '/super-admin',
};

for (const [role, route] of Object.entries(routesByRole) as [UserRole, string][]) {
  app.get(route, requireAuth(JWT_SECRET), requireRole(role), (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
}

app.get(
  '/shared',
  requireAuth(JWT_SECRET),
  requireRole(UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD),
  (_req, res) => {
    res.status(200).json({ status: 'ok' });
  },
);
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

function createAuthorizationHeader(role: UserRole): { Authorization: string } {
  const token = jwt.sign({ userId: `${role.toLowerCase()}-id`, role }, JWT_SECRET, {
    expiresIn: '24h',
  });
  return { Authorization: `Bearer ${token}` };
}

for (const role of Object.values(UserRole)) {
  test(`${role} can call a route that allows its role`, async () => {
    const response = await fetch(`${baseUrl}${routesByRole[role]}`, {
      headers: createAuthorizationHeader(role),
    });

    assert.equal(response.status, 200);
  });

  test(`${role} receives 403 from a route that does not allow its role`, async () => {
    const response = await fetch(`${baseUrl}${deniedRouteByRole[role]}`, {
      headers: createAuthorizationHeader(role),
    });

    assert.equal(response.status, 403);
  });
}

test('a protected route returns 401 without a token', async () => {
  const response = await fetch(`${baseUrl}/super-admin`);

  assert.equal(response.status, 401);
});

test('a route can allow more than one role declaratively', async () => {
  const response = await fetch(`${baseUrl}/shared`, {
    headers: createAuthorizationHeader(UserRole.TEAM_LEAD),
  });

  assert.equal(response.status, 200);
});
