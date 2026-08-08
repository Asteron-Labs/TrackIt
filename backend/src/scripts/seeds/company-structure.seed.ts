import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { TeamProjection, TeamsService } from '../../modules/teams/teams.service';
import { UserRole } from '../../modules/users/users.entity';
import { UserProjection, UsersService } from '../../modules/users/users.service';

const SEED_PASSWORD = 'TrackIt123!';

const seededTeams = [
  {
    name: 'Platform Team',
    description: 'Owns the core TrackIt platform and backend services.',
  },
  {
    name: 'Frontend Team',
    description: 'Builds the TrackIt web experience.',
  },
];

const seededUsers = [
  {
    name: 'TrackIt Admin',
    email: 'admin@trackit.local',
    role: UserRole.SUPER_ADMIN,
  },
  {
    name: 'Priya',
    email: 'priya@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Platform Team',
    leadsTeam: true,
  },
  {
    name: 'Alex',
    email: 'alex@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Platform Team',
  },
  {
    name: 'Maya',
    email: 'maya@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Platform Team',
  },
  {
    name: 'Jordan',
    email: 'jordan@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Platform Team',
  },
  {
    name: 'Diego',
    email: 'diego@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Platform Team',
  },
  {
    name: 'Sam',
    email: 'sam@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Frontend Team',
    leadsTeam: true,
  },
  {
    name: 'Elena',
    email: 'elena@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Frontend Team',
  },
  {
    name: 'Noah',
    email: 'noah@trackit.local',
    role: UserRole.EMPLOYEE,
    teamName: 'Frontend Team',
  },
];

export interface CompanyStructureSeedResult {
  createdUsers: number;
  createdTeams: number;
  addedMemberships: number;
  assignedLeads: number;
}

export async function seedCompanyStructure(
  usersService: UsersService,
  teamsService: TeamsService,
): Promise<CompanyStructureSeedResult> {
  const result: CompanyStructureSeedResult = {
    createdUsers: 0,
    createdTeams: 0,
    addedMemberships: 0,
    assignedLeads: 0,
  };
  const usersByEmail = new Map<string, UserProjection>();

  for (const seededUser of seededUsers) {
    const existingUser = await usersService.findByEmail(seededUser.email);
    if (existingUser) {
      usersByEmail.set(seededUser.email, {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        teamId: null,
      });
      continue;
    }

    const createdUser = await usersService.createUser({
      name: seededUser.name,
      email: seededUser.email,
      password: SEED_PASSWORD,
      role: seededUser.role,
    });
    usersByEmail.set(seededUser.email, createdUser);
    result.createdUsers += 1;
  }

  const admin = usersByEmail.get('admin@trackit.local');
  if (!admin) {
    throw new Error('Seeded Super Admin was not found');
  }

  const adminCaller: AuthenticatedUser = {
    userId: admin.id,
    role: UserRole.SUPER_ADMIN,
  };
  const teamsByName = new Map<string, TeamProjection>();
  const existingTeams = await teamsService.listTeams(adminCaller);
  for (const team of existingTeams) {
    teamsByName.set(team.name, team);
  }

  for (const seededTeam of seededTeams) {
    if (teamsByName.has(seededTeam.name)) {
      continue;
    }

    const createdTeam = await teamsService.createTeam(seededTeam);
    teamsByName.set(seededTeam.name, createdTeam);
    result.createdTeams += 1;
  }

  for (const seededUser of seededUsers) {
    if (!seededUser.teamName) {
      continue;
    }

    const user = usersByEmail.get(seededUser.email);
    const team = teamsByName.get(seededUser.teamName);
    if (!user || !team) {
      throw new Error(`Seed data is incomplete for ${seededUser.email}`);
    }

    const isMember = await teamsService.isMember(user.id, team.id);
    if (!isMember) {
      await teamsService.addMember(team.id, user.id);
      result.addedMemberships += 1;
    }
  }

  for (const seededUser of seededUsers) {
    if (!seededUser.leadsTeam || !seededUser.teamName) {
      continue;
    }

    const user = usersByEmail.get(seededUser.email);
    const team = teamsByName.get(seededUser.teamName);
    if (!user || !team) {
      throw new Error(`Seed lead data is incomplete for ${seededUser.email}`);
    }
    if (team.leadId === user.id) {
      continue;
    }

    await teamsService.assignTeamLead(team.id, user.id);
    team.leadId = user.id;
    result.assignedLeads += 1;
  }

  return result;
}
