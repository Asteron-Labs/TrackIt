import { DEFAULT_WEEKLY_CAPACITY } from '../../common/config/constants';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { UserRole } from '../users/users.entity';
import { Team } from './teams.entity';
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
}

export interface TeamDetailsProjection extends TeamProjection {
  lead: TeamMemberProjection | null;
  members: TeamMemberProjection[];
  memberCount: number;
}

export class TeamsService {
  constructor(private readonly teamRepository: TeamRepository) {}

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

    const result = await this.teamRepository.findByIdWithMembers(
      teamId,
      this.accessFilterFor(caller),
    );
    if (!result) {
      throw new ForbiddenError('You do not have access to this team');
    }

    return {
      ...this.toProjection(result.team),
      lead: result.lead,
      members: result.members,
      memberCount: result.members.length,
    };
  }

  isLedBy(userId: string, teamId: string): Promise<boolean> {
    return this.teamRepository.isLedBy(userId, teamId);
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
}
