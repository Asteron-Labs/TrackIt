import { ScopeService } from '../../common/authorization/scope.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { GoalProjection, GoalService } from '../goals/goals.service';
import { TeamMemberProjection, TeamsService } from '../teams/teams.service';
import { UserRole } from '../users/users.entity';
import { BusinessImpact, Task, TaskPriority, TaskStatus } from './tasks.entity';
import { TaskAccessFilter, TaskRepository, UpdateTaskRecord } from './tasks.repository';

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

export function isTaskOverdue(dueDate: string, status: TaskStatus, today: string): boolean {
  return dueDate < today && status !== TaskStatus.DONE;
}

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly goalService: GoalService,
    private readonly teamsService: TeamsService,
    private readonly scopeService: ScopeService,
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
}
