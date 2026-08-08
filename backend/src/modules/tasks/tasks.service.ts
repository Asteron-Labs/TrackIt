import { ScopeService } from '../../common/authorization/scope.service';
import { EFFORT_OVERRUN_THRESHOLD } from '../../common/config';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { GoalProjection, GoalService } from '../goals/goals.service';
import { TeamMemberProjection, TeamsService } from '../teams/teams.service';
import type { TaskEffortEntryProjection, TaskEffortSource } from '../timesheets/timesheets.service';
import { UserRole } from '../users/users.entity';
import { BusinessImpact, Task, TaskPriority, TaskStatus } from './tasks.entity';
import {
  MyTaskFilter,
  TaskAccessFilter,
  TaskRepository,
  TaskWithGoalRecord,
  UpdateTaskRecord,
} from './tasks.repository';

export interface CreateTaskDto {
  title: string;
  description?: string;
  priority: TaskPriority;
  estimatedHours: number;
  dueDate: string;
}

export type UpdateTaskDto = Partial<
  Pick<CreateTaskDto, 'title' | 'description' | 'priority' | 'estimatedHours' | 'dueDate'>
>;

export interface TaskAssigneeProjection {
  id: string;
  name: string;
}

export interface TaskProjection {
  id: string;
  goalId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  dueDate: string;
  assigneeId: string | null;
  assignee: TaskAssigneeProjection | null;
  businessImpact: BusinessImpact | null;
  priorityScore: number | null;
  overdue: boolean;
  dueDatePastGoalDeadline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyTaskProjection {
  id: string;
  goalId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  dueDate: string;
  overdue: boolean;
  goal: {
    id: string;
    title: string;
  };
}

export type EffortVarianceStatus =
  | 'UNDER_ESTIMATE'
  | 'ON_ESTIMATE'
  | 'OVER_ESTIMATE'
  | 'OVERRUN';

export interface TaskEffortResult {
  estimatedHours: number;
  actualHours: number;
  variance: number;
  variancePercent: number | null;
  varianceStatus: EffortVarianceStatus;
  entries: TaskEffortEntryProjection[];
}

export type LoadTaskEffort = (taskId: string) => Promise<TaskEffortSource>;

export function isTaskOverdue(dueDate: string, status: TaskStatus, today: string): boolean {
  return dueDate < today && status !== TaskStatus.DONE;
}

export function classifyEffortVariance(
  estimatedHours: number,
  actualHours: number,
): EffortVarianceStatus {
  if (actualHours < estimatedHours) return 'UNDER_ESTIMATE';
  if (actualHours === estimatedHours) return 'ON_ESTIMATE';
  if (estimatedHours === 0) return 'OVERRUN';

  const consumedPercent = (actualHours / estimatedHours) * 100;
  if (consumedPercent > EFFORT_OVERRUN_THRESHOLD) return 'OVERRUN';
  return 'OVER_ESTIMATE';
}

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly goalService: GoalService,
    private readonly teamsService: TeamsService,
    private readonly scopeService: ScopeService,
    private readonly loadTaskEffort: LoadTaskEffort,
  ) {}

  async createTask(
    goalId: string,
    dto: CreateTaskDto,
    caller: AuthenticatedUser,
  ): Promise<TaskProjection> {
    const goal = await this.goalService.getGoal(goalId, caller);
    await this.assertCanManageTeam(caller, goal.teamId);
    this.assertPositiveEstimate(dto.estimatedHours);

    const task = await this.taskRepository.create({
      goalId,
      title: dto.title,
      description: dto.description ?? '',
      status: TaskStatus.TODO,
      priority: dto.priority,
      estimatedHours: dto.estimatedHours,
      dueDate: dto.dueDate,
      assigneeId: null,
      businessImpact: null,
      priorityScore: null,
    });

    return this.toProjection(task, goal.deadline, new Map());
  }

  async listGoalTasks(goalId: string, caller: AuthenticatedUser): Promise<TaskProjection[]> {
    const goal = await this.goalService.getGoal(goalId, caller);
    const tasks = await this.taskRepository.findByGoal(
      goalId,
      this.accessFilterFor(caller, goal.teamId),
    );
    const assignees = await this.loadAssignees(goal, tasks, caller);
    return tasks.map((task) => this.toProjection(task, goal.deadline, assignees));
  }

  async getMyTasks(callerId: string, filter: MyTaskFilter): Promise<MyTaskProjection[]> {
    const records = await this.taskRepository.findByAssignee(callerId, filter);
    const today = new Date().toISOString().slice(0, 10);
    return records.map((record) => this.toMyTaskProjection(record, today));
  }

  async getTask(taskId: string, caller: AuthenticatedUser): Promise<TaskProjection> {
    const existingTask = await this.taskRepository.findById(taskId);
    if (!existingTask) {
      throw new NotFoundError('Task not found');
    }

    const goal = await this.goalService.getGoal(existingTask.goalId, caller);
    const task = await this.taskRepository.findById(
      taskId,
      this.accessFilterFor(caller, goal.teamId),
    );
    if (!task) {
      throw new ForbiddenError('You do not have access to this task');
    }

    const assignees = await this.loadAssignees(goal, [task], caller);
    return this.toProjection(task, goal.deadline, assignees);
  }

  async getTaskEffort(taskId: string, caller: AuthenticatedUser): Promise<TaskEffortResult> {
    const task = await this.getTask(taskId, caller);
    const effort = await this.loadTaskEffort(taskId);
    const variance = effort.actualHours - task.estimatedHours;
    const variancePercent =
      task.estimatedHours === 0 ? null : (variance / task.estimatedHours) * 100;

    return {
      estimatedHours: task.estimatedHours,
      actualHours: effort.actualHours,
      variance,
      variancePercent,
      varianceStatus: classifyEffortVariance(task.estimatedHours, effort.actualHours),
      entries: effort.entries,
    };
  }

  async updateTask(
    taskId: string,
    dto: UpdateTaskDto,
    caller: AuthenticatedUser,
  ): Promise<TaskProjection> {
    const existingTask = await this.taskRepository.findById(taskId);
    if (!existingTask) {
      throw new NotFoundError('Task not found');
    }

    const goal = await this.goalService.getGoal(existingTask.goalId, caller);
    await this.assertCanManageTeam(caller, goal.teamId);
    const task = await this.taskRepository.findById(
      taskId,
      this.accessFilterFor(caller, goal.teamId),
    );
    if (!task) {
      throw new ForbiddenError('You do not have access to this task');
    }
    if (dto.estimatedHours !== undefined) {
      this.assertPositiveEstimate(dto.estimatedHours);
    }

    const updatedTask = await this.taskRepository.update(taskId, dto as UpdateTaskRecord);
    const assignees = await this.loadAssignees(goal, [updatedTask], caller);
    return this.toProjection(updatedTask, goal.deadline, assignees);
  }

  async updateStatus(
    taskId: string,
    status: TaskStatus,
    caller: AuthenticatedUser,
  ): Promise<TaskProjection> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const goal = await this.goalService.getGoal(task.goalId, caller);
    if (caller.role === UserRole.EMPLOYEE) {
      if (!task.assigneeId) {
        throw new ForbiddenError('You can only update your own assigned tasks');
      }
      this.scopeService.assertOwnsResource(caller.userId, task.assigneeId);
    }

    const updatedTask = await this.taskRepository.updateStatus(taskId, status);
    const assignees = await this.loadAssignees(goal, [updatedTask], caller);
    return this.toProjection(updatedTask, goal.deadline, assignees);
  }

  async assignTask(
    taskId: string,
    assigneeId: string | null,
    caller: AuthenticatedUser,
  ): Promise<TaskProjection> {
    if (caller.role !== UserRole.TEAM_LEAD) {
      throw new ForbiddenError('Only Team Leads can assign tasks');
    }

    const existingTask = await this.taskRepository.findById(taskId);
    if (!existingTask) {
      throw new NotFoundError('Task not found');
    }

    const goal = await this.goalService.getGoal(existingTask.goalId, caller);
    await this.scopeService.assertTeamLeadOf(caller.userId, goal.teamId);
    if (assigneeId !== null) {
      await this.scopeService.assertMemberOf(assigneeId, goal.teamId);
    }

    const updatedTask = await this.taskRepository.updateAssignee(taskId, assigneeId);
    const assignees = await this.loadAssignees(goal, [updatedTask], caller);
    return this.toProjection(updatedTask, goal.deadline, assignees);
  }

  private async assertCanManageTeam(caller: AuthenticatedUser, teamId: string): Promise<void> {
    if (caller.role === UserRole.SUPER_ADMIN) return;
    if (caller.role !== UserRole.TEAM_LEAD) {
      throw new ForbiddenError('Employees cannot manage tasks');
    }
    await this.scopeService.assertTeamLeadOf(caller.userId, teamId);
  }

  private accessFilterFor(caller: AuthenticatedUser, teamId: string): TaskAccessFilter {
    if (caller.role === UserRole.SUPER_ADMIN) return {};
    if (caller.role === UserRole.TEAM_LEAD) return { teamId };
    return { teamId, assigneeId: caller.userId };
  }

  private async loadAssignees(
    goal: GoalProjection,
    tasks: Task[],
    caller: AuthenticatedUser,
  ): Promise<Map<string, TeamMemberProjection>> {
    if (!tasks.some((task) => task.assigneeId !== null)) return new Map();
    const team = await this.teamsService.getTeamDetails(goal.teamId, caller);
    return new Map(team.members.map((member) => [member.id, member]));
  }

  private assertPositiveEstimate(estimatedHours: number): void {
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
      throw new ValidationError('Estimated hours must be greater than zero');
    }
  }

  private toProjection(
    task: Task,
    goalDeadline: string,
    assignees: Map<string, TeamMemberProjection>,
  ): TaskProjection {
    const assignee = task.assigneeId ? assignees.get(task.assigneeId) : undefined;
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: task.id,
      goalId: task.goalId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
      businessImpact: task.businessImpact,
      priorityScore: task.priorityScore,
      overdue: isTaskOverdue(task.dueDate, task.status, today),
      dueDatePastGoalDeadline: task.dueDate > goalDeadline,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private toMyTaskProjection(record: TaskWithGoalRecord, today: string): MyTaskProjection {
    return {
      id: record.task.id,
      goalId: record.task.goalId,
      title: record.task.title,
      status: record.task.status,
      priority: record.task.priority,
      estimatedHours: record.task.estimatedHours,
      dueDate: record.task.dueDate,
      overdue: isTaskOverdue(record.task.dueDate, record.task.status, today),
      goal: {
        id: record.goal.id,
        title: record.goal.title,
      },
    };
  }
}
