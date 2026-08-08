export type GoalStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type GoalImportance = "LOW" | "MEDIUM" | "HIGH";

export interface GoalTaskStatusBreakdown {
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
}

export interface Goal {
  id: string;
  teamId: string;
  title: string;
  description: string;
  startDate: string;
  deadline: string;
  status: GoalStatus;
  importance: GoalImportance;
  createdById: string;
  progress: number;
  noTasksYet: boolean;
  taskStatusBreakdown: GoalTaskStatusBreakdown;
  createdAt: string;
  updatedAt: string;
}

export interface GoalsResponse {
  goals: Goal[];
}

export interface GoalResponse {
  goal: Goal;
}
