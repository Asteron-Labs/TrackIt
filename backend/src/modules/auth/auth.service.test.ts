import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { InvalidCredentialsError, UnauthorizedError } from '../../common/errors';
import { User, UserRole } from '../users/users.entity';
import { UserRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

async function createUser(): Promise<User> {
  const user = new User();
  user.id = 'd47a48b8-0f91-4d17-aac0-9bf98a1e0c30';
  user.email = 'admin@trackit.local';
  user.passwordHash = await bcrypt.hash('TrackIt123!', 4);
  user.name = 'TrackIt Admin';
  user.role = UserRole.SUPER_ADMIN;
  user.createdAt = new Date();
  user.updatedAt = new Date();
  return user;
}

function createAuthService(user: User | null): AuthService {
  const userRepository = {
    findByEmail: async () => user,
    findById: async () => user,
  } as unknown as UserRepository;

  return new AuthService(new UsersService(userRepository), JWT_SECRET);
}

test('login returns a valid JWT and a safe user projection', async () => {
  const user = await createUser();
  const authService = createAuthService(user);

  const result = await authService.login(user.email, 'TrackIt123!');
  const payload = jwt.verify(result.token, JWT_SECRET) as JwtPayload;

  assert.deepEqual(result.user, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  assert.equal('passwordHash' in result.user, false);
  assert.equal(payload.userId, user.id);
  assert.equal(payload.role, user.role);
  assert.equal(payload.exp! - payload.iat!, 24 * 60 * 60);
});

test('login rejects an incorrect password with the generic credentials error', async () => {
  const authService = createAuthService(await createUser());

  await assert.rejects(
    () => authService.login('admin@trackit.local', 'wrong-password'),
    (error: unknown) =>
      error instanceof InvalidCredentialsError &&
      error.statusCode === 401 &&
      error.message === 'Invalid email or password',
  );
});

test('login rejects an unknown email with the same generic credentials error', async () => {
  const authService = createAuthService(null);

  await assert.rejects(
    () => authService.login('unknown@trackit.local', 'wrong-password'),
    (error: unknown) =>
      error instanceof InvalidCredentialsError &&
      error.statusCode === 401 &&
      error.message === 'Invalid email or password',
  );
});

test('getCurrentUser rejects a token identity that no longer exists', async () => {
  const authService = createAuthService(null);

  await assert.rejects(
    () => authService.getCurrentUser('missing-user'),
    (error: unknown) => error instanceof UnauthorizedError && error.statusCode === 401,
  );
});
