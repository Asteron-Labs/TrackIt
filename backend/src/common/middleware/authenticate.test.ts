import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors';
import { UserRole } from '../../modules/users/users.entity';
import { authenticateToken } from './authenticate';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const userId = 'd47a48b8-0f91-4d17-aac0-9bf98a1e0c30';

function assertUnauthorized(authorizationHeader: string | undefined): void {
  assert.throws(
    () => authenticateToken(authorizationHeader, JWT_SECRET),
    (error: unknown) => error instanceof UnauthorizedError && error.statusCode === 401,
  );
}

test('authenticateToken accepts a valid bearer token', () => {
  const token = jwt.sign({ userId, role: UserRole.EMPLOYEE }, JWT_SECRET, { expiresIn: '24h' });

  assert.deepEqual(authenticateToken(`Bearer ${token}`, JWT_SECRET), {
    userId,
    role: UserRole.EMPLOYEE,
  });
});

test('authenticateToken rejects a missing or malformed authorization header', () => {
  assertUnauthorized(undefined);
  assertUnauthorized('Token value');
  assertUnauthorized('Bearer ');
  assertUnauthorized('Bearer not-a-jwt');
});

test('authenticateToken rejects a token signed with another secret', () => {
  const token = jwt.sign(
    { userId, role: UserRole.EMPLOYEE },
    'different-secret-that-is-also-32-characters',
  );

  assertUnauthorized(`Bearer ${token}`);
});

test('authenticateToken rejects an expired token', () => {
  const token = jwt.sign({ userId, role: UserRole.EMPLOYEE }, JWT_SECRET, { expiresIn: -1 });

  assertUnauthorized(`Bearer ${token}`);
});

test('authenticateToken rejects claims with an unknown role', () => {
  const token = jwt.sign({ userId, role: 'MANAGER' }, JWT_SECRET);

  assertUnauthorized(`Bearer ${token}`);
});
