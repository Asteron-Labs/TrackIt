import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { User, UserRole } from '../users/users.entity';
import { Team, TeamMember } from './teams.entity';

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
  joinedAt: Date;
}

export class TeamRepository extends BaseRepository<Team> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource, Team);
  }

  async create(teamRecord: CreateTeamRecord): Promise<Team> {
    const team = this.repo.create(teamRecord);
    return this.repo.save(team);
  }

  findById(teamId: string): Promise<Team | null> {
    return this.repo.findOne({ where: { id: teamId } });
  }

  findByIdWithAccess(teamId: string, access: TeamAccessFilter): Promise<Team | null> {
    const query = this.repo.createQueryBuilder('team').where('team.id = :teamId', { teamId });
    this.applyAccessFilter(query, access);
    return query.getOne();
  }

  findAll(access: TeamAccessFilter): Promise<Team[]> {
    const query = this.repo.createQueryBuilder('team').orderBy('team.name', 'ASC');
    this.applyAccessFilter(query, access);
    return query.getMany();
  }

  async addMember(teamId: string, userId: string): Promise<TeamMember> {
    const memberRepository = this.dataSource.getRepository(TeamMember);
    const membership = memberRepository.create({ teamId, userId });
    return memberRepository.save(membership);
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.dataSource.getRepository(TeamMember).delete({ teamId, userId });
  }

  async findMembersByTeam(teamId: string): Promise<TeamMemberRecord[]> {
    const rows = await this.dataSource
      .getRepository(TeamMember)
      .createQueryBuilder('membership')
      .innerJoin(User, 'member', 'member.id = membership.user_id')
      .select('member.id', 'member_id')
      .addSelect('member.name', 'member_name')
      .addSelect('member.email', 'member_email')
      .addSelect('member.role', 'member_role')
      .addSelect('membership.team_id', 'team_id')
      .addSelect('membership.joined_at', 'joined_at')
      .where('membership.team_id = :teamId', { teamId })
      .orderBy('member.name', 'ASC')
      .getRawMany<Record<string, string | Date>>();

    return rows.map((row) => ({
      id: row.member_id as string,
      name: row.member_name as string,
      email: row.member_email as string,
      role: row.member_role as UserRole,
      teamId: row.team_id as string,
      joinedAt: new Date(row.joined_at),
    }));
  }

  findTeamsByUser(userId: string): Promise<Team[]> {
    return this.repo
      .createQueryBuilder('team')
      .innerJoin(
        TeamMember,
        'membership',
        'membership.team_id = team.id AND membership.user_id = :userId',
        { userId },
      )
      .orderBy('team.name', 'ASC')
      .getMany();
  }

  isMember(userId: string, teamId: string): Promise<boolean> {
    return this.dataSource.getRepository(TeamMember).existsBy({ userId, teamId });
  }

  existsByName(name: string): Promise<boolean> {
    return this.repo.existsBy({ name });
  }

  isLedBy(userId: string, teamId: string): Promise<boolean> {
    return this.repo.existsBy({ id: teamId, leadId: userId });
  }

  async assignTeamLead(teamId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const team = await manager
        .getRepository(Team)
        .createQueryBuilder('team')
        .setLock('pessimistic_write')
        .where('team.id = :teamId', { teamId })
        .getOneOrFail();

      if (team.leadId && team.leadId !== userId) {
        await manager.update(User, team.leadId, { role: UserRole.EMPLOYEE });
      }

      await manager.update(User, userId, { role: UserRole.TEAM_LEAD });
      await manager.update(Team, teamId, { leadId: userId });
    });
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
        TeamMember,
        'caller_membership',
        'caller_membership.team_id = team.id AND caller_membership.user_id = :accessMemberId',
        { accessMemberId: access.memberId },
      );
    }
  }
}
