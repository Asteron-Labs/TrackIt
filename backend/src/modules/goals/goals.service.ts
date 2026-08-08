import { ScopeService } from '../../common/authorization/scope.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { UserRole } from '../users/users.entity';
import { Goal, GoalImportance, GoalStatus } from './goals.entity';
import { GoalFilter, GoalRepository, UpdateGoalRecord } from './goals.repository';

export interface CreateGoalDto {
  teamId: string;
  title: string;
  description?: string;
  startDate: string;
  deadline: string;
  importance: GoalImportance;
}

export type UpdateGoalDto = Partial<
  Pick<CreateGoalDto, 'title' | 'description' | 'startDate' | 'deadline' | 'importance'> & {
    status: GoalStatus;
  }
>;

export interface GoalProjection {
  id: string;
  teamId: string;
  title: string;
  description: string;
  startDate: string;
  deadline: string;
  status: GoalStatus;
  importance: GoalImportance;
  createdById: string;
  progress: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class GoalService {
  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly scopeService: ScopeService,
  ) {}

  async createGoal(dto: CreateGoalDto, caller: AuthenticatedUser): Promise<GoalProjection> {
    await this.assertCanManageTeam(caller, dto.teamId);
    this.assertValidDates(dto.startDate, dto.deadline);

    const goal = await this.goalRepository.create({
      teamId: dto.teamId,
      title: dto.title,
      description: dto.description ?? '',
      startDate: dto.startDate,
      deadline: dto.deadline,
      status: GoalStatus.PLANNED,
      importance: dto.importance,
      createdById: caller.userId,
    });

    return this.toProjection(goal);
  }

  async listTeamGoals(
    teamId: string,
    filter: GoalFilter,
    caller: AuthenticatedUser,
  ): Promise<GoalProjection[]> {
    await this.assertCanViewTeam(caller, teamId);
    const goals = await this.goalRepository.findByTeam(teamId, filter);
    return goals.map((goal) => this.toProjection(goal));
  }

  async getGoal(goalId: string, caller: AuthenticatedUser): Promise<GoalProjection> {
    const existingGoal = await this.goalRepository.findById(goalId);
    if (!existingGoal) {
      throw new NotFoundError('Goal not found');
    }

    await this.assertCanViewTeam(caller, existingGoal.teamId);
    const scopedGoal = await this.goalRepository.findById(goalId, { teamId: existingGoal.teamId });
    if (!scopedGoal) {
      throw new ForbiddenError('You do not have access to this goal');
    }

    return this.toProjection(scopedGoal);
  }

  async updateGoal(
    goalId: string,
    dto: UpdateGoalDto,
    caller: AuthenticatedUser,
  ): Promise<GoalProjection> {
    const existingGoal = await this.goalRepository.findById(goalId);
    if (!existingGoal) {
      throw new NotFoundError('Goal not found');
    }

    await this.assertCanManageTeam(caller, existingGoal.teamId);
    const scopedGoal = await this.goalRepository.findById(goalId, { teamId: existingGoal.teamId });
    if (!scopedGoal) {
      throw new ForbiddenError('You do not have access to this goal');
    }

    this.assertValidDates(
      dto.startDate ?? scopedGoal.startDate,
      dto.deadline ?? scopedGoal.deadline,
    );
    const updatedGoal = await this.goalRepository.update(goalId, dto as UpdateGoalRecord);
    return this.toProjection(updatedGoal);
  }

  private async assertCanManageTeam(caller: AuthenticatedUser, teamId: string): Promise<void> {
    if (caller.role === UserRole.SUPER_ADMIN) return;
    if (caller.role !== UserRole.TEAM_LEAD) {
      throw new ForbiddenError('Employees cannot manage goals');
    }
    await this.scopeService.assertTeamLeadOf(caller.userId, teamId);
  }

  private async assertCanViewTeam(caller: AuthenticatedUser, teamId: string): Promise<void> {
    if (caller.role === UserRole.SUPER_ADMIN) return;
    if (caller.role === UserRole.TEAM_LEAD) {
      await this.scopeService.assertTeamLeadOf(caller.userId, teamId);
      return;
    }
    await this.scopeService.assertMemberOf(caller.userId, teamId);
  }

  private assertValidDates(startDate: string, deadline: string): void {
    if (deadline <= startDate) {
      throw new ValidationError('Deadline must fall after the start date');
    }
  }

  private toProjection(goal: Goal): GoalProjection {
    return {
      id: goal.id,
      teamId: goal.teamId,
      title: goal.title,
      description: goal.description,
      startDate: goal.startDate,
      deadline: goal.deadline,
      status: goal.status,
      importance: goal.importance,
      createdById: goal.createdById,
      progress: null,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }
}
