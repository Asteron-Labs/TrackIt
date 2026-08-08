import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { User, UserRole } from '../users/users.entity';
import { Team } from './teams.entity';

export interface CreateTeamRecord {
  name: string;
  description: string;
  leadId: string | null;
  weeklyCapacityHours: number;
}

export interface TeamAccessFilter {
  leadId?: string;
  memberId?: string;
}

export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
}

export interface TeamWithMembersRecord {
  team: Team;
  lead: TeamMemberRecord | null;
  members: TeamMemberRecord[];
}

export class TeamRepository extends BaseRepository<Team> {
  constructor(dataSource: DataSource) {
    super(dataSource, Team);
  }

  async create(teamRecord: CreateTeamRecord): Promise<Team> {
    const team = this.repo.create(teamRecord);
    return this.repo.save(team);
  }

  findById(teamId: string): Promise<Team | null> {
    return this.repo.findOne({ where: { id: teamId } });
  }

  findAll(access: TeamAccessFilter): Promise<Team[]> {
    const query = this.repo.createQueryBuilder('team').orderBy('team.name', 'ASC');
    this.applyAccessFilter(query, access);
    return query.getMany();
  }

  async findByIdWithMembers(
    teamId: string,
    access: TeamAccessFilter,
  ): Promise<TeamWithMembersRecord | null> {
    const query = this.repo
      .createQueryBuilder('team')
      .leftJoin(User, 'team_lead', 'team_lead.id = team.lead_id')
      .leftJoin(User, 'team_member', 'team_member.team_id = team.id')
      .select('team')
      .addSelect('team_lead.id', 'lead_user_id')
      .addSelect('team_lead.name', 'lead_user_name')
      .addSelect('team_lead.email', 'lead_user_email')
      .addSelect('team_lead.role', 'lead_user_role')
      .addSelect('team_lead.team_id', 'lead_user_team_id')
      .addSelect('team_member.id', 'member_user_id')
      .addSelect('team_member.name', 'member_user_name')
      .addSelect('team_member.email', 'member_user_email')
      .addSelect('team_member.role', 'member_user_role')
      .addSelect('team_member.team_id', 'member_user_team_id')
      .where('team.id = :teamId', { teamId })
      .orderBy('team_member.name', 'ASC');

    this.applyAccessFilter(query, access);
    const { entities, raw } = await query.getRawAndEntities();
    if (entities.length === 0) return null;

    const lead = raw[0].lead_user_id ? this.toUserRecord(raw[0], 'lead') : null;
    const members = raw
      .filter((row) => row.member_user_id)
      .map((row) => this.toUserRecord(row, 'member'));

    return { team: entities[0], lead, members };
  }

  existsByName(name: string): Promise<boolean> {
    return this.repo.existsBy({ name });
  }

  isLedBy(userId: string, teamId: string): Promise<boolean> {
    return this.repo.existsBy({ id: teamId, leadId: userId });
  }

  private applyAccessFilter(
    query: ReturnType<typeof this.repo.createQueryBuilder>,
    access: TeamAccessFilter,
  ): void {
    if (access.leadId) {
      query.andWhere('team.lead_id = :accessLeadId', {
        accessLeadId: access.leadId,
      });
    }

    if (access.memberId) {
      query.innerJoin(
        User,
        'caller_membership',
        'caller_membership.team_id = team.id AND caller_membership.id = :accessMemberId',
        { accessMemberId: access.memberId },
      );
    }
  }

  private toUserRecord(row: Record<string, string>, prefix: 'lead' | 'member'): TeamMemberRecord {
    return {
      id: row[`${prefix}_user_id`],
      name: row[`${prefix}_user_name`],
      email: row[`${prefix}_user_email`],
      role: row[`${prefix}_user_role`] as UserRole,
      teamId: row[`${prefix}_user_team_id`],
    };
  }
}
