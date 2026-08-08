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

export interface CompanyDashboardFilters {
  teamId?: string;
  goalId?: string;
}

export interface CompanyDashboardKpis {
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

export interface CompanySummaryResponse {
  range: DashboardDateRange;
  filters: CompanyDashboardFilters;
  kpis: CompanyDashboardKpis;
  teams: CompanyTeamSummary[];
  employees: CompanyEmployeeWorkload[];
}
