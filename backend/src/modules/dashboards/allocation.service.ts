import { WORKLOAD_AVAILABLE_MAX, WORKLOAD_BALANCED_MAX } from '../../common/config/constants';
import { ScopeService } from '../../common/authorization/scope.service';
import { ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { GoalStatus } from '../goals/goals.entity';
import { GoalProjection, GoalService } from '../goals/goals.service';
import { TaskStatus } from '../tasks/tasks.entity';
import { isTaskOverdue } from '../tasks/tasks.service';
import { UserRole } from '../users/users.entity';
import { AllocationRepository, EmployeeWorkloadData } from './allocation.repository';

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

    return workloadData.map((employee) => ({
      ...employee,
      utilisation: calculateUtilisation(
        employee.estimatedHoursOnActiveTasks,
        employee.weeklyCapacityHours,
      ),
      workload: classifyWorkload(
        employee.estimatedHoursOnActiveTasks,
        employee.weeklyCapacityHours,
      ),
    }));
  }
}
