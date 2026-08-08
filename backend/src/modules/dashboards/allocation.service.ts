import { WORKLOAD_AVAILABLE_MAX, WORKLOAD_BALANCED_MAX } from '../../common/config/constants';
import { ScopeService } from '../../common/authorization/scope.service';
import { ForbiddenError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { GoalStatus } from '../goals/goals.entity';
import { GoalProjection, GoalService } from '../goals/goals.service';
import { TaskStatus } from '../tasks/tasks.entity';
import { isTaskOverdue } from '../tasks/tasks.service';
import { UserRole } from '../users/users.entity';
import {
  AllocationRepository,
  CompanyWorkloadFilter,
  EmployeeWorkloadData,
} from './allocation.repository';

export type WorkloadClassification = 'AVAILABLE' | 'BALANCED' | 'OVERLOADED';

export interface EmployeeWorkload extends EmployeeWorkloadData {
  utilisation: number;
  workload: WorkloadClassification;
}

export interface TeamSummaryRange {
  from: string;
  to: string;
}

export interface TeamSummaryKpis {
  activeGoals: number;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
}

export interface TeamSummaryResult {
  range: TeamSummaryRange;
  kpis: TeamSummaryKpis;
  employees: EmployeeWorkload[];
  activeGoals: GoalProjection[];
}

export interface CompanySummaryFilter {
  from?: string;
  to?: string;
  teamId?: string;
  goalId?: string;
}

export interface CompanySummaryKpis {
  totalTeams: number;
  totalEmployees: number;
  activeGoals: number;
  totalTasks: number;
  overdueTasks: number;
}

export interface CompanyTeamSummary {
  teamId: string;
  teamName: string;
  memberCount: number;
  activeGoals: number;
  totalTasks: number;
  overdueTasks: number;
  averageUtilisation: number;
  overloadedMemberCount: number;
  availableMemberCount: number;
}

export interface CompanyEmployeeWorkload extends EmployeeWorkload {
  teamId: string;
  teamName: string;
}

export interface CompanySummaryResult {
  range: TeamSummaryRange;
  filters: Pick<CompanySummaryFilter, 'teamId' | 'goalId'>;
  kpis: CompanySummaryKpis;
  teams: CompanyTeamSummary[];
  employees: CompanyEmployeeWorkload[];
}

function calculateUtilisation(estimatedHours: number, capacityHours: number): number {
  return (estimatedHours / capacityHours) * 100;
}

export function classifyWorkload(
  estimatedHours: number,
  capacityHours: number,
): WorkloadClassification {
  const utilisation = calculateUtilisation(estimatedHours, capacityHours);

  if (utilisation <= WORKLOAD_AVAILABLE_MAX) return 'AVAILABLE';
  if (utilisation <= WORKLOAD_BALANCED_MAX) return 'BALANCED';
  return 'OVERLOADED';
}

export class AllocationService {
  constructor(
    private readonly allocationRepository: AllocationRepository,
    private readonly goalService: GoalService,
    private readonly scopeService: ScopeService,
  ) {}

  async getTeamSummary(
    teamId: string,
    range: TeamSummaryRange,
    caller: AuthenticatedUser,
  ): Promise<TeamSummaryResult> {
    if (caller.role !== UserRole.SUPER_ADMIN) {
      await this.scopeService.assertTeamLeadOf(caller.userId, teamId);
    }
    if (range.from > range.to) {
      throw new ValidationError('From date must be on or before to date');
    }

    const [employees, activeGoals, tasks] = await Promise.all([
      this.getEmployeeWorkloads(teamId, range.from, range.to),
      this.goalService.listTeamGoals(teamId, { status: GoalStatus.ACTIVE }, caller),
      this.allocationRepository.getTeamTaskData(teamId),
    ]);
    const today = new Date().toISOString().slice(0, 10);

    return {
      range,
      kpis: {
        activeGoals: activeGoals.length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((task) => task.status === TaskStatus.DONE).length,
        blockedTasks: tasks.filter((task) => task.status === TaskStatus.BLOCKED).length,
        overdueTasks: tasks.filter((task) => isTaskOverdue(task.dueDate, task.status, today)).length,
      },
      employees,
      activeGoals,
    };
  }

  async getEmployeeWorkloads(
    teamId: string,
    from: string,
    to: string,
  ): Promise<EmployeeWorkload[]> {
    const workloadData = await this.allocationRepository.getEmployeeWorkloadData(teamId, from, to);

    return workloadData.map((employee) => this.toEmployeeWorkload(employee));
  }

  async getCompanySummary(
    filter: CompanySummaryFilter,
    caller: AuthenticatedUser,
  ): Promise<CompanySummaryResult> {
    if (caller.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admins can view the company dashboard');
    }

    const range = this.resolveCompanyRange(filter);
    const repositoryFilter: CompanyWorkloadFilter = {
      ...range,
      teamId: filter.teamId,
      goalId: filter.goalId,
    };
    const workloadData = await this.allocationRepository.getCompanyWorkloadData(repositoryFilter);
    const today = new Date().toISOString().slice(0, 10);

    const teams = workloadData.map((team) => {
      const employees = team.employees.map((employee) => this.toEmployeeWorkload(employee));
      const totalUtilisation = employees.reduce(
        (sum, employee) => sum + employee.utilisation,
        0,
      );

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        memberCount: employees.length,
        activeGoals: team.activeGoalCount,
        totalTasks: team.tasks.length,
        overdueTasks: team.tasks.filter((task) =>
          isTaskOverdue(task.dueDate, task.status, today),
        ).length,
        averageUtilisation: employees.length === 0 ? 0 : totalUtilisation / employees.length,
        overloadedMemberCount: employees.filter(
          (employee) => employee.workload === 'OVERLOADED',
        ).length,
        availableMemberCount: employees.filter((employee) => employee.workload === 'AVAILABLE')
          .length,
      };
    });
    const employees = workloadData.flatMap((team) =>
      team.employees.map((employee) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        ...this.toEmployeeWorkload(employee),
      })),
    );

    return {
      range,
      filters: { teamId: filter.teamId, goalId: filter.goalId },
      kpis: {
        totalTeams: teams.length,
        totalEmployees: teams.reduce((sum, team) => sum + team.memberCount, 0),
        activeGoals: teams.reduce((sum, team) => sum + team.activeGoals, 0),
        totalTasks: teams.reduce((sum, team) => sum + team.totalTasks, 0),
        overdueTasks: teams.reduce((sum, team) => sum + team.overdueTasks, 0),
      },
      teams,
      employees,
    };
  }

  private toEmployeeWorkload(employee: EmployeeWorkloadData): EmployeeWorkload {
    return {
      ...employee,
      utilisation: calculateUtilisation(
        employee.estimatedHoursOnActiveTasks,
        employee.weeklyCapacityHours,
      ),
      workload: classifyWorkload(
        employee.estimatedHoursOnActiveTasks,
        employee.weeklyCapacityHours,
      ),
    };
  }

  private resolveCompanyRange(filter: CompanySummaryFilter): TeamSummaryRange {
    if (Boolean(filter.from) !== Boolean(filter.to)) {
      throw new ValidationError('From and to dates must be provided together');
    }
    if (filter.from && filter.to) {
      if (filter.from > filter.to) {
        throw new ValidationError('From date must be on or before to date');
      }
      return { from: filter.from, to: filter.to };
    }

    const today = new Date();
    const daysSinceMonday = (today.getUTCDay() + 6) % 7;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - daysSinceMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    };
  }
}
