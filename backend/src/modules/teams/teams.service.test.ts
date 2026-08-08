import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { UserRole } from '../users/users.entity';
import { Team } from './teams.entity';
import {
  CreateTeamRecord,
  TeamAccessFilter,
  TeamRepository,
  TeamWithMembersRecord,
} from './teams.repository';
import { TeamsService } from './teams.service';

function createStoredTeam(overrides: Partial<Team> = {}): Team {
  const team = new Team();
  team.id = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
  team.name = 'Platform';
  team.description = 'Builds the company platform.';
  team.leadId = null;
  team.weeklyCapacityHours = 40;
  team.createdAt = new Date('2026-08-08T08:00:00.000Z');
  team.updatedAt = new Date('2026-08-08T08:00:00.000Z');
  return Object.assign(team, overrides);
}

function caller(role: UserRole): AuthenticatedUser {
  return { userId: `${role.toLowerCase()}-id`, role };
}

test('createTeam creates an empty team with the default weekly capacity', async () => {
  let createdRecord: CreateTeamRecord | undefined;
  const teamRepository = {
    existsByName: async () => false,
    create: async (record: CreateTeamRecord) => {
      createdRecord = record;
      return createStoredTeam(record);
    },
  } as unknown as TeamRepository;
  const teamsService = new TeamsService(teamRepository);

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
  assert.equal(team.weeklyCapacityHours, 40);
});

test('createTeam rejects a duplicate name before persistence', async () => {
  let createWasCalled = false;
  const teamRepository = {
    existsByName: async () => true,
    create: async () => {
      createWasCalled = true;
      return createStoredTeam();
    },
  } as unknown as TeamRepository;
  const teamsService = new TeamsService(teamRepository);

  await assert.rejects(
    () => teamsService.createTeam({ name: 'Platform' }),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.statusCode === 409 &&
      error.message === 'A team with this name already exists',
  );
  assert.equal(createWasCalled, false);
});

for (const [role, expectedAccess] of [
  [UserRole.SUPER_ADMIN, {}],
  [UserRole.TEAM_LEAD, { leadId: 'team_lead-id' }],
  [UserRole.EMPLOYEE, { memberId: 'employee-id' }],
] as const) {
  test(`listTeams applies ${role} scope in the repository query`, async () => {
    let receivedAccess: TeamAccessFilter | undefined;
    const teamRepository = {
      findAll: async (access: TeamAccessFilter) => {
        receivedAccess = access;
        return [createStoredTeam()];
      },
    } as unknown as TeamRepository;
    const teamsService = new TeamsService(teamRepository);

    const teams = await teamsService.listTeams(caller(role));

    assert.deepEqual(receivedAccess, expectedAccess);
    assert.equal(teams.length, 1);
  });
}

test('getTeamDetails returns the lead, all members, and member count', async () => {
  const team = createStoredTeam({ leadId: 'lead-id' });
  const record: TeamWithMembersRecord = {
    team,
    lead: {
      id: 'lead-id',
      name: 'Nimal Silva',
      email: 'nimal@example.com',
      role: UserRole.TEAM_LEAD,
      teamId: team.id,
    },
    members: [
      {
        id: 'lead-id',
        name: 'Nimal Silva',
        email: 'nimal@example.com',
        role: UserRole.TEAM_LEAD,
        teamId: team.id,
      },
      {
        id: 'employee-id',
        name: 'Asha Perera',
        email: 'asha@example.com',
        role: UserRole.EMPLOYEE,
        teamId: team.id,
      },
    ],
  };
  const teamRepository = {
    findById: async () => team,
    findByIdWithMembers: async () => record,
  } as unknown as TeamRepository;
  const teamsService = new TeamsService(teamRepository);

  const details = await teamsService.getTeamDetails(team.id, caller(UserRole.SUPER_ADMIN));

  assert.equal(details.lead?.id, 'lead-id');
  assert.equal(details.members.length, 2);
  assert.equal(details.memberCount, 2);
});

test('getTeamDetails represents a team with no lead or members', async () => {
  const team = createStoredTeam();
  const teamRepository = {
    findById: async () => team,
    findByIdWithMembers: async () => ({ team, lead: null, members: [] }),
  } as unknown as TeamRepository;
  const teamsService = new TeamsService(teamRepository);

  const details = await teamsService.getTeamDetails(team.id, caller(UserRole.SUPER_ADMIN));

  assert.equal(details.lead, null);
  assert.deepEqual(details.members, []);
  assert.equal(details.memberCount, 0);
});

test('getTeamDetails returns not found when the team does not exist', async () => {
  const teamRepository = {
    findById: async () => null,
  } as unknown as TeamRepository;
  const teamsService = new TeamsService(teamRepository);

  await assert.rejects(
    () => teamsService.getTeamDetails('missing-team-id', caller(UserRole.SUPER_ADMIN)),
    (error: unknown) => error instanceof NotFoundError && error.message === 'Team not found',
  );
});

test('getTeamDetails rejects an existing team outside the caller scope', async () => {
  const teamRepository = {
    findById: async () => createStoredTeam(),
    findByIdWithMembers: async () => null,
  } as unknown as TeamRepository;
  const teamsService = new TeamsService(teamRepository);

  await assert.rejects(
    () =>
      teamsService.getTeamDetails(
        '6bf8cd4f-02af-4211-8e0e-619f888f7381',
        caller(UserRole.TEAM_LEAD),
      ),
    (error: unknown) => error instanceof ForbiddenError && error.statusCode === 403,
  );
});
