import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { User, UserRole } from '../users/users.entity';
import { UsersService } from '../users/users.service';
import { Team, TeamMember } from './teams.entity';
import { CreateTeamRecord, TeamAccessFilter, TeamRepository } from './teams.repository';
import { TeamsService } from './teams.service';

const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const USER_ID = '2a32a99d-5ae1-485f-9bed-bd3470eabf46';
const JOINED_AT = new Date('2026-08-08T08:00:00.000Z');

function createStoredTeam(overrides: Partial<Team> = {}): Team {
  const team = new Team();
  team.id = TEAM_ID;
  team.name = 'Platform';
  team.description = 'Builds the company platform.';
  team.leadId = null;
  team.weeklyCapacityHours = 40;
  team.createdAt = JOINED_AT;
  team.updatedAt = JOINED_AT;
  return Object.assign(team, overrides);
}

function createStoredUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = USER_ID;
  user.name = 'Asha Perera';
  user.email = 'asha@example.com';
  user.passwordHash = 'stored-password-hash';
  user.role = UserRole.EMPLOYEE;
  user.createdAt = JOINED_AT;
  user.updatedAt = JOINED_AT;
  return Object.assign(user, overrides);
}

function createMembership(): TeamMember {
  const membership = new TeamMember();
  membership.id = '85f4b95a-e11c-4f91-a7f1-b026199133dd';
  membership.teamId = TEAM_ID;
  membership.userId = USER_ID;
  membership.joinedAt = JOINED_AT;
  return membership;
}

function createService(
  teamRepository: Partial<TeamRepository>,
  usersService: Partial<UsersService> = {},
): TeamsService {
  return new TeamsService(teamRepository as TeamRepository, usersService as UsersService);
}

function caller(role: UserRole): AuthenticatedUser {
  return { userId: `${role.toLowerCase()}-id`, role };
}

test('createTeam creates an empty team with the default weekly capacity', async () => {
  let createdRecord: CreateTeamRecord | undefined;
  const teamsService = createService({
    existsByName: async () => false,
    create: async (record: CreateTeamRecord) => {
      createdRecord = record;
      return createStoredTeam(record);
    },
  });

  const team = await teamsService.createTeam({
    name: 'Platform',
    description: 'Builds the company platform.',
  });

  assert.deepEqual(createdRecord, {
    name: 'Platform',
    description: 'Builds the company platform.',
    leadId: null,
    weeklyCapacityHours: 40,
  });
  assert.equal(team.leadId, null);
});

test('createTeam rejects a duplicate name before persistence', async () => {
  const teamsService = createService({ existsByName: async () => true });

  await assert.rejects(
    () => teamsService.createTeam({ name: 'Platform' }),
    (error: unknown) =>
      error instanceof ConflictError && error.message === 'A team with this name already exists',
  );
});

for (const [role, expectedAccess] of [
  [UserRole.SUPER_ADMIN, {}],
  [UserRole.TEAM_LEAD, { leadId: 'team_lead-id' }],
  [UserRole.EMPLOYEE, { memberId: 'employee-id' }],
] as const) {
  test(`listTeams applies ${role} scope in the repository query`, async () => {
    let receivedAccess: TeamAccessFilter | undefined;
    const teamsService = createService({
      findAll: async (access: TeamAccessFilter) => {
        receivedAccess = access;
        return [createStoredTeam()];
      },
    });

    await teamsService.listTeams(caller(role));

    assert.deepEqual(receivedAccess, expectedAccess);
  });
}

test('getTeamDetails returns the lead, members, and member count', async () => {
  const team = createStoredTeam({ leadId: USER_ID });
  const member = {
    id: USER_ID,
    name: 'Asha Perera',
    email: 'asha@example.com',
    role: UserRole.TEAM_LEAD,
    teamId: TEAM_ID,
    joinedAt: JOINED_AT,
  };
  const teamsService = createService({
    findById: async () => team,
    findByIdWithAccess: async () => team,
    findMembersByTeam: async () => [member],
  });

  const details = await teamsService.getTeamDetails(TEAM_ID, caller(UserRole.SUPER_ADMIN));

  assert.deepEqual(details.lead, member);
  assert.deepEqual(details.members, [member]);
  assert.equal(details.memberCount, 1);
});

test('getTeamDetails rejects an existing team outside caller scope', async () => {
  const teamsService = createService({
    findById: async () => createStoredTeam(),
    findByIdWithAccess: async () => null,
  });

  await assert.rejects(
    () => teamsService.getTeamDetails(TEAM_ID, caller(UserRole.TEAM_LEAD)),
    (error: unknown) => error instanceof ForbiddenError,
  );
});

test('addMember adds an unassigned employee', async () => {
  const user = createStoredUser();
  const membership = createMembership();
  const teamsService = createService(
    {
      findById: async () => createStoredTeam(),
      findTeamsByUser: async () => [],
      addMember: async () => membership,
    },
    { findById: async () => user },
  );

  const member = await teamsService.addMember(TEAM_ID, USER_ID);

  assert.deepEqual(member, {
    id: USER_ID,
    name: user.name,
    email: user.email,
    role: UserRole.EMPLOYEE,
    teamId: TEAM_ID,
    joinedAt: JOINED_AT,
  });
});

test('addMember rejects duplicate membership', async () => {
  const teamsService = createService(
    {
      findById: async () => createStoredTeam(),
      findTeamsByUser: async () => [createStoredTeam()],
    },
    { findById: async () => createStoredUser() },
  );

  await assert.rejects(
    () => teamsService.addMember(TEAM_ID, USER_ID),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.message === 'Employee is already a member of this team',
  );
});

test('addMember rejects an employee assigned to another team', async () => {
  const teamsService = createService(
    {
      findById: async () => createStoredTeam(),
      findTeamsByUser: async () => [createStoredTeam({ id: 'other-team-id' })],
    },
    { findById: async () => createStoredUser() },
  );

  await assert.rejects(
    () => teamsService.addMember(TEAM_ID, USER_ID),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.message === 'Employee already belongs to another team',
  );
});

test('addMember rejects a user who is not an employee', async () => {
  const teamsService = createService(
    { findById: async () => createStoredTeam() },
    { findById: async () => createStoredUser({ role: UserRole.SUPER_ADMIN }) },
  );

  await assert.rejects(
    () => teamsService.addMember(TEAM_ID, USER_ID),
    (error: unknown) =>
      error instanceof ConflictError && error.message === 'Only employees can be added to a team',
  );
});

test('assignTeamLead requires existing membership', async () => {
  const teamsService = createService({
    findById: async () => createStoredTeam(),
    isMember: async () => false,
  });

  await assert.rejects(
    () => teamsService.assignTeamLead(TEAM_ID, USER_ID),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.message === 'The team lead must already be a member of this team',
  );
});

test('assignTeamLead returns the promoted member', async () => {
  let assignedUserId: string | undefined;
  const lead = {
    id: USER_ID,
    name: 'Asha Perera',
    email: 'asha@example.com',
    role: UserRole.TEAM_LEAD,
    teamId: TEAM_ID,
    joinedAt: JOINED_AT,
  };
  const teamsService = createService({
    findById: async () => createStoredTeam(),
    isMember: async () => true,
    assignTeamLead: async (_teamId, userId) => {
      assignedUserId = userId;
    },
    findMembersByTeam: async () => [lead],
  });

  const result = await teamsService.assignTeamLead(TEAM_ID, USER_ID);

  assert.equal(assignedUserId, USER_ID);
  assert.deepEqual(result, lead);
});

test('removeMember blocks removal of the current lead', async () => {
  const teamsService = createService({
    findById: async () => createStoredTeam({ leadId: USER_ID }),
    isMember: async () => true,
  });

  await assert.rejects(
    () => teamsService.removeMember(TEAM_ID, USER_ID),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.message === 'Reassign the team lead before removing this member',
  );
});

test('removeMember removes an ordinary member', async () => {
  let removedUserId: string | undefined;
  const teamsService = createService({
    findById: async () => createStoredTeam(),
    isMember: async () => true,
    removeMember: async (_teamId, userId) => {
      removedUserId = userId;
    },
  });

  await teamsService.removeMember(TEAM_ID, USER_ID);

  assert.equal(removedUserId, USER_ID);
});

test('removeMember rejects a user who is not a member', async () => {
  const teamsService = createService({
    findById: async () => createStoredTeam(),
    isMember: async () => false,
  });

  await assert.rejects(
    () => teamsService.removeMember(TEAM_ID, USER_ID),
    (error: unknown) => error instanceof NotFoundError,
  );
});
