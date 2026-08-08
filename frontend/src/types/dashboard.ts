import type { Goal } from './goal';

export type WorkloadClassification = 'AVAILABLE' | 'BALANCED' | 'OVERLOADED';

export interface DashboardDateRange {
  from: string;
  to: string;
}

export interface TeamDashboardKpis {
  activeGoals: number;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
}

export interface EmployeeWorkload {
  employeeId: string;
  employeeName: string;
  weeklyCapacityHours: number;
  activeTaskCount: number;
  estimatedHoursOnActiveTasks: number;
  recordedHours: number;
  utilisation: number;
  workload: WorkloadClassification;
}

export interface TeamSummaryResponse {
  range: DashboardDateRange;
  kpis: TeamDashboardKpis;
  employees: EmployeeWorkload[];
  activeGoals: Goal[];
}
