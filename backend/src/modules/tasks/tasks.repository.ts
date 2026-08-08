import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { Goal } from '../goals/goals.entity';
import { BusinessImpact, Task, TaskPriority, TaskStatus } from './tasks.entity';

export interface CreateTaskRecord {
  goalId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  dueDate: string;
  assigneeId: string | null;
  businessImpact: BusinessImpact | null;
  priorityScore: number | null;
}

export interface TaskAccessFilter {
  teamId?: string;
  assigneeId?: string;
}

export interface MyTaskFilter {
  status?: TaskStatus;
  dueBefore?: string;
}

export interface TaskGoalRecord {
  id: string;
  title: string;
  deadline: string;
}

export interface TaskWithGoalRecord {
  task: Task;
  goal: TaskGoalRecord;
}

export type UpdateTaskRecord = Partial<
  Pick<Task, 'title' | 'description' | 'priority' | 'estimatedHours' | 'dueDate'>
>;

export type TaskStatusCounts = Record<TaskStatus, number>;

export class TaskRepository extends BaseRepository<Task> {
  constructor(dataSource: DataSource) {
    super(dataSource, Task);
  }

  async create(taskRecord: CreateTaskRecord): Promise<Task> {
    const task = this.repo.create(taskRecord);
    return this.repo.save(task);
  }

  findById(taskId: string, access: TaskAccessFilter = {}): Promise<Task | null> {
    const query = this.repo.createQueryBuilder('task').where('task.id = :taskId', { taskId });
    this.applyAccessFilter(query, access);
    return query.getOne();
  }

  findByGoal(goalId: string, access: TaskAccessFilter = {}): Promise<Task[]> {
    const query = this.repo
      .createQueryBuilder('task')
      .where('task.goal_id = :goalId', { goalId })
      .orderBy('task.due_date', 'ASC')
      .addOrderBy('task.title', 'ASC');
    this.applyAccessFilter(query, access);
    return query.getMany();
  }

  async findByAssignee(
    assigneeId: string,
    filter: MyTaskFilter = {},
  ): Promise<TaskWithGoalRecord[]> {
    const query = this.repo
      .createQueryBuilder('task')
      .innerJoin(Goal, 'goal', 'goal.id = task.goal_id')
      .addSelect('goal.id', 'parent_goal_id')
      .addSelect('goal.title', 'parent_goal_title')
      .addSelect('goal.deadline', 'parent_goal_deadline')
      .where('task.assignee_id = :assigneeId', { assigneeId })
      .orderBy('task.due_date', 'ASC')
      .addOrderBy('task.title', 'ASC');

    if (filter.status) {
      query.andWhere('task.status = :status', { status: filter.status });
    }
    if (filter.dueBefore) {
      query.andWhere('task.due_date < :dueBefore', { dueBefore: filter.dueBefore });
    }

    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((task, index) => ({
      task,
      goal: {
        id: raw[index].parent_goal_id,
        title: raw[index].parent_goal_title,
        deadline: raw[index].parent_goal_deadline,
      },
    }));
  }

  findByTeam(teamId: string): Promise<Task[]> {
    return this.repo
      .createQueryBuilder('task')
      .innerJoin('goals', 'goal', 'goal.id = task.goal_id')
      .where('goal.team_id = :teamId', { teamId })
      .orderBy('task.due_date', 'ASC')
      .addOrderBy('task.title', 'ASC')
      .getMany();
  }

  async update(taskId: string, changes: UpdateTaskRecord): Promise<Task> {
    await this.repo.update(taskId, changes);
    return this.repo.findOneByOrFail({ id: taskId });
  }

  async updateAssignee(taskId: string, assigneeId: string | null): Promise<Task> {
    await this.repo.update(taskId, { assigneeId });
    return this.repo.findOneByOrFail({ id: taskId });
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    await this.repo.update(taskId, { status });
    return this.repo.findOneByOrFail({ id: taskId });
  }

  async countByGoalAndStatus(goalId: string): Promise<TaskStatusCounts> {
    const rows = await this.repo
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(task.id)', 'count')
      .where('task.goal_id = :goalId', { goalId })
      .groupBy('task.status')
      .getRawMany<{ status: TaskStatus; count: string }>();

    const counts: TaskStatusCounts = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.BLOCKED]: 0,
      [TaskStatus.DONE]: 0,
    };
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  private applyAccessFilter(query: SelectQueryBuilder<Task>, access: TaskAccessFilter): void {
    if (access.teamId) {
      query.innerJoin('goals', 'access_goal', 'access_goal.id = task.goal_id');
      query.andWhere('access_goal.team_id = :accessTeamId', {
        accessTeamId: access.teamId,
      });
    }

    if (access.assigneeId) {
      query.andWhere('task.assignee_id = :accessAssigneeId', {
        accessAssigneeId: access.assigneeId,
      });
    }
  }
}
