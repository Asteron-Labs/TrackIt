import type { GoalStatus } from "../types/goal";

export const goalStatusLabels: Record<GoalStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function isGoalPastDeadline(
  deadline: string,
  status: GoalStatus,
  today: string,
): boolean {
  if (status === "COMPLETED" || status === "CANCELLED") return false;
  return deadline < today;
}
