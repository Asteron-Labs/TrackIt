import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { Goal, GoalImportance, GoalStatus } from './goals.entity';

export interface CreateGoalRecord {
  teamId: string;
  title: string;
  description: string;
  startDate: string;
  deadline: string;
  status: GoalStatus;
  importance: GoalImportance;
  createdById: string;
}

export interface GoalFilter {
  status?: GoalStatus;
}

export interface GoalAccessFilter {
  teamId?: string;
}

export type UpdateGoalRecord = Partial<
  Pick<Goal, 'title' | 'description' | 'startDate' | 'deadline' | 'status' | 'importance'>
>;

export class GoalRepository extends BaseRepository<Goal> {
  constructor(dataSource: DataSource) {
    super(dataSource, Goal);
  }

  async create(goalRecord: CreateGoalRecord): Promise<Goal> {
    const goal = this.repo.create(goalRecord);
    return this.repo.save(goal);
  }

  findById(goalId: string, access: GoalAccessFilter = {}): Promise<Goal | null> {
    const query = this.repo.createQueryBuilder('goal').where('goal.id = :goalId', { goalId });

    if (access.teamId) {
      query.andWhere('goal.team_id = :accessTeamId', { accessTeamId: access.teamId });
    }

    return query.getOne();
  }

  findByTeam(teamId: string, filter: GoalFilter = {}): Promise<Goal[]> {
    const query = this.repo
      .createQueryBuilder('goal')
      .where('goal.team_id = :teamId', { teamId })
      .orderBy('goal.deadline', 'ASC')
      .addOrderBy('goal.title', 'ASC');

    if (filter.status) {
      query.andWhere('goal.status = :status', { status: filter.status });
    }

    return query.getMany();
  }

  async update(goalId: string, changes: UpdateGoalRecord): Promise<Goal> {
    await this.repo.update(goalId, changes);
    return this.repo.findOneByOrFail({ id: goalId });
  }
}
