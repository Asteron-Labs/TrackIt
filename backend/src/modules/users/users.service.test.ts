import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { ConflictError } from '../../common/errors';
import { User, UserRole } from './users.entity';
import { CreateUserRecord, UserFilter, UserRepository } from './users.repository';
import { UsersService } from './users.service';

function createStoredUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = '2a32a99d-5ae1-485f-9bed-bd3470eabf46';
  user.name = 'Asha Perera';
  user.email = 'asha@example.com';
  user.passwordHash = 'stored-password-hash';
  user.role = UserRole.EMPLOYEE;
  user.teamId = null;
  user.createdAt = new Date();
  user.updatedAt = new Date();
  return Object.assign(user, overrides);
}

test('createUser hashes the password, persists the user, and returns a safe projection', async () => {
  let createdRecord: CreateUserRecord | undefined;
  const userRepository = {
    existsByEmail: async () => false,
    create: async (record: CreateUserRecord) => {
      createdRecord = record;
      return createStoredUser(record);
    },
  } as unknown as UserRepository;
  const usersService = new UsersService(userRepository);

  const user = await usersService.createUser({
    name: 'Asha Perera',
    email: 'asha@example.com',
    password: 'safe-password',
    role: UserRole.EMPLOYEE,
  });

  assert.ok(createdRecord);
  assert.equal(await bcrypt.compare('safe-password', createdRecord.passwordHash), true);
  assert.deepEqual(user, {
    id: '2a32a99d-5ae1-485f-9bed-bd3470eabf46',
    name: 'Asha Perera',
    email: 'asha@example.com',
    role: UserRole.EMPLOYEE,
    teamId: null,
  });
  assert.equal('passwordHash' in user, false);
});

test('createUser rejects a duplicate email before hashing or persistence', async () => {
  let createWasCalled = false;
  const userRepository = {
    existsByEmail: async () => true,
    create: async () => {
      createWasCalled = true;
      return createStoredUser();
    },
  } as unknown as UserRepository;
  const usersService = new UsersService(userRepository);

  await assert.rejects(
    () =>
      usersService.createUser({
        name: 'Duplicate User',
        email: 'asha@example.com',
        password: 'safe-password',
        role: UserRole.TEAM_LEAD,
      }),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.statusCode === 409 &&
      error.message === 'A user with this email already exists',
  );
  assert.equal(createWasCalled, false);
});

test('listUsers forwards repository filters and removes password hashes', async () => {
  let receivedFilter: UserFilter | undefined;
  const userRepository = {
    findAll: async (filter: UserFilter) => {
      receivedFilter = filter;
      return [createStoredUser()];
    },
  } as unknown as UserRepository;
  const usersService = new UsersService(userRepository);
  const filter = { role: UserRole.EMPLOYEE, unassigned: true };

  const users = await usersService.listUsers(filter);

  assert.deepEqual(receivedFilter, filter);
  assert.equal(users.length, 1);
  assert.equal('passwordHash' in users[0], false);
  assert.equal(users[0].teamId, null);
});
