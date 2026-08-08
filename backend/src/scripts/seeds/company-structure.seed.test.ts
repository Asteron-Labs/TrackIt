import assert from 'node:assert/strict';
import test from 'node:test';
import { TeamProjection, TeamsService } from '../../modules/teams/teams.service';
import { User, UserRole } from '../../modules/users/users.entity';
import { CreateUserDto, UserProjection, UsersService } from '../../modules/users/users.service';
import { seedCompanyStructure } from './company-structure.seed';

interface SeedWrites {
  users: number;
  teams: number;
  memberships: number;
  leads: number;
}

interface SeedHarness {
  usersByEmail: Map<string, User>;
  teamsByName: Map<string, TeamProjection>;
  membershipsByTeamId: Map<string, Set<string>>;
  suppliedPasswords: string[];
  writes: SeedWrites;
  usersService: UsersService;
  teamsService: TeamsService;
}

const STORED_AT = new Date('2026-08-08T08:00:00.000Z');

function createStoredUser(name: string, email: string, role: UserRole, id = `user-${email}`): User {
  const user = new User();
  user.id = id;
  user.name = name;
  user.email = email;
  user.passwordHash = 'stored-password-hash';
  user.role = role;
  user.createdAt = STORED_AT;
  user.updatedAt = STORED_AT;
  return user;
}

function createStoredTeam(name: string, id = `team-${name}`): TeamProjection {
  return {
    id,
    name,
    description: `${name} description`,
    leadId: null,
    weeklyCapacityHours: 40,
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
  };
}

function toUserProjection(user: User): UserProjection {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: null,
  };
}

function createSeedHarness(
  initialUsers: User[] = [],
  initialTeams: TeamProjection[] = [],
): SeedHarness {
  const usersByEmail = new Map(initialUsers.map((user) => [user.email, user]));
  const teamsByName = new Map(initialTeams.map((team) => [team.name, team]));
  const membershipsByTeamId = new Map<string, Set<string>>();
  const suppliedPasswords: string[] = [];
  const writes: SeedWrites = { users: 0, teams: 0, memberships: 0, leads: 0 };

  const usersService = {
    findByEmail: async (email: string) => usersByEmail.get(email) ?? null,
    createUser: async (dto: CreateUserDto) => {
      const user = createStoredUser(dto.name, dto.email, dto.role);
      usersByEmail.set(user.email, user);
      suppliedPasswords.push(dto.password);
      writes.users += 1;
      return toUserProjection(user);
    },
  } as unknown as UsersService;

  const teamsService = {
    listTeams: async () => [...teamsByName.values()],
    createTeam: async (dto: { name: string; description?: string }) => {
      const team: TeamProjection = {
        ...createStoredTeam(dto.name),
        description: dto.description ?? '',
      };
      teamsByName.set(team.name, team);
      writes.teams += 1;
      return team;
    },
    isMember: async (userId: string, teamId: string) =>
      membershipsByTeamId.get(teamId)?.has(userId) ?? false,
    addMember: async (teamId: string, userId: string) => {
      const memberships = membershipsByTeamId.get(teamId) ?? new Set<string>();
      memberships.add(userId);
      membershipsByTeamId.set(teamId, memberships);
      writes.memberships += 1;

      const user = [...usersByEmail.values()].find((candidate) => candidate.id === userId);
      if (!user) throw new Error('Test user not found');
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId,
        joinedAt: STORED_AT,
      };
    },
    assignTeamLead: async (teamId: string, userId: string) => {
      const team = [...teamsByName.values()].find((candidate) => candidate.id === teamId);
      const user = [...usersByEmail.values()].find((candidate) => candidate.id === userId);
      if (!team || !user) throw new Error('Test lead data not found');

      team.leadId = userId;
      user.role = UserRole.TEAM_LEAD;
      writes.leads += 1;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId,
        joinedAt: STORED_AT,
      };
    },
  } as unknown as TeamsService;

  return {
    usersByEmail,
    teamsByName,
    membershipsByTeamId,
    suppliedPasswords,
    writes,
    usersService,
    teamsService,
  };
}

test('seeds the complete company structure and does not write on a second run', async () => {
  const harness = createSeedHarness();

  const firstResult = await seedCompanyStructure(harness.usersService, harness.teamsService);

  assert.deepEqual(firstResult, {
    createdUsers: 9,
    createdTeams: 2,
    addedMemberships: 8,
    assignedLeads: 2,
  });
  assert.equal(harness.usersByEmail.size, 9);
  assert.equal(
    [...harness.usersByEmail.values()].filter((user) => user.role === UserRole.SUPER_ADMIN).length,
    1,
  );
  assert.equal(
    [...harness.usersByEmail.values()].filter((user) => user.role === UserRole.TEAM_LEAD).length,
    2,
  );
  assert.equal(
    [...harness.usersByEmail.values()].filter((user) => user.role === UserRole.EMPLOYEE).length,
    6,
  );
  assert.equal(harness.membershipsByTeamId.get('team-Platform Team')?.size, 5);
  assert.equal(harness.membershipsByTeamId.get('team-Frontend Team')?.size, 3);
  assert.equal(harness.teamsByName.get('Platform Team')?.leadId, 'user-priya@trackit.local');
  assert.equal(harness.teamsByName.get('Frontend Team')?.leadId, 'user-sam@trackit.local');
  assert.deepEqual(harness.suppliedPasswords, Array(9).fill('TrackIt123!'));

  const writesAfterFirstRun = { ...harness.writes };
  const secondResult = await seedCompanyStructure(harness.usersService, harness.teamsService);

  assert.deepEqual(secondResult, {
    createdUsers: 0,
    createdTeams: 0,
    addedMemberships: 0,
    assignedLeads: 0,
  });
  assert.deepEqual(harness.writes, writesAfterFirstRun);
});

test('fills missing records when part of the company structure already exists', async () => {
  const existingAdmin = createStoredUser(
    'TrackIt Admin',
    'admin@trackit.local',
    UserRole.SUPER_ADMIN,
  );
  const existingPlatformTeam = createStoredTeam('Platform Team');
  const harness = createSeedHarness([existingAdmin], [existingPlatformTeam]);

  const result = await seedCompanyStructure(harness.usersService, harness.teamsService);

  assert.deepEqual(result, {
    createdUsers: 8,
    createdTeams: 1,
    addedMemberships: 8,
    assignedLeads: 2,
  });
  assert.equal(harness.usersByEmail.size, 9);
  assert.equal(harness.teamsByName.size, 2);
  assert.equal(harness.suppliedPasswords.length, 8);
});
