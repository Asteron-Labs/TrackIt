export type GoalStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type GoalImportance = "LOW" | "MEDIUM" | "HIGH";

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
  progress: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalsResponse {
  goals: Goal[];
}

export interface GoalResponse {
  goal: Goal;
}
