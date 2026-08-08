import { DEFAULT_WEEKLY_CAPACITY } from '../../common/config/constants';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { User, UserRole } from '../users/users.entity';
import { UsersService } from '../users/users.service';
import { Team, TeamMember } from './teams.entity';
import { TeamRepository } from './teams.repository';

export interface CreateTeamDto {
  name: string;
  description?: string;
  weeklyCapacityHours?: number;
}

export interface TeamProjection {
  id: string;
  name: string;
  description: string;
  leadId: string | null;
  weeklyCapacityHours: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberProjection {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
  joinedAt: Date;
}

export interface TeamDetailsProjection extends TeamProjection {
  lead: TeamMemberProjection | null;
  members: TeamMemberProjection[];
  memberCount: number;
}

export class TeamsService {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly usersService: UsersService,
  ) {}

  async createTeam(dto: CreateTeamDto): Promise<TeamProjection> {
    const nameExists = await this.teamRepository.existsByName(dto.name);
    if (nameExists) {
      throw new ConflictError('A team with this name already exists');
    }

    const team = await this.teamRepository.create({
      name: dto.name,
      description: dto.description ?? '',
      leadId: null,
      weeklyCapacityHours: dto.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY,
    });

    return this.toProjection(team);
  }

  async listTeams(caller: AuthenticatedUser): Promise<TeamProjection[]> {
    const teams = await this.teamRepository.findAll(this.accessFilterFor(caller));
    return teams.map((team) => this.toProjection(team));
  }

  async getTeamDetails(teamId: string, caller: AuthenticatedUser): Promise<TeamDetailsProjection> {
    const teamExists = await this.teamRepository.findById(teamId);
    if (!teamExists) {
      throw new NotFoundError('Team not found');
    }

    const team = await this.teamRepository.findByIdWithAccess(teamId, this.accessFilterFor(caller));
    if (!team) {
      throw new ForbiddenError('You do not have access to this team');
    }

    const members = await this.teamRepository.findMembersByTeam(teamId);
    return {
      ...this.toProjection(team),
      lead: members.find((member) => member.id === team.leadId) ?? null,
      members,
      memberCount: members.length,
    };
  }

  async addMember(teamId: string, userId: string): Promise<TeamMemberProjection> {
    await this.assertTeamExists(teamId);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (user.role !== UserRole.EMPLOYEE) {
      throw new ConflictError('Only employees can be added to a team');
    }

    const existingTeams = await this.teamRepository.findTeamsByUser(userId);
    if (existingTeams.some((team) => team.id === teamId)) {
      throw new ConflictError('Employee is already a member of this team');
    }
    if (existingTeams.length > 0) {
      throw new ConflictError('Employee already belongs to another team');
    }

    const membership = await this.teamRepository.addMember(teamId, userId);
    return this.toMemberProjection(user, membership);
  }

  async assignTeamLead(teamId: string, userId: string): Promise<TeamMemberProjection> {
    await this.assertTeamExists(teamId);
    const isMember = await this.teamRepository.isMember(userId, teamId);
    if (!isMember) {
      throw new ConflictError('The team lead must already be a member of this team');
    }

    await this.teamRepository.assignTeamLead(teamId, userId);
    const members = await this.teamRepository.findMembersByTeam(teamId);
    const lead = members.find((member) => member.id === userId);
    if (!lead) {
      throw new NotFoundError('Team member not found');
    }
    return lead;
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const team = await this.assertTeamExists(teamId);
    const isMember = await this.teamRepository.isMember(userId, teamId);
    if (!isMember) {
      throw new NotFoundError('Team member not found');
    }
    if (team.leadId === userId) {
      throw new ConflictError('Reassign the team lead before removing this member');
    }

    await this.teamRepository.removeMember(teamId, userId);
  }

  isLedBy(userId: string, teamId: string): Promise<boolean> {
    return this.teamRepository.isLedBy(userId, teamId);
  }

  isMember(userId: string, teamId: string): Promise<boolean> {
    return this.teamRepository.isMember(userId, teamId);
  }

  private async assertTeamExists(teamId: string): Promise<Team> {
    const team = await this.teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team not found');
    }
    return team;
  }

  private accessFilterFor(caller: AuthenticatedUser) {
    if (caller.role === UserRole.SUPER_ADMIN) return {};
    if (caller.role === UserRole.TEAM_LEAD) return { leadId: caller.userId };
    return { memberId: caller.userId };
  }

  private toProjection(team: Team): TeamProjection {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      leadId: team.leadId,
      weeklyCapacityHours: team.weeklyCapacityHours,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  private toMemberProjection(user: User, membership: TeamMember): TeamMemberProjection {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: membership.teamId,
      joinedAt: membership.joinedAt,
    };
  }
}
