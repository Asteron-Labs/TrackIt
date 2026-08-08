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

export interface GoalDeadlineDisplay {
  text: string;
  overdue: boolean;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getGoalDeadlineDisplay(
  deadline: string,
  status: GoalStatus,
  today: string,
): GoalDeadlineDisplay {
  const deadlineTime = Date.parse(`${deadline}T00:00:00.000Z`);
  const todayTime = Date.parse(`${today}T00:00:00.000Z`);
  const daysRemaining = Math.round(
    (deadlineTime - todayTime) / MILLISECONDS_PER_DAY,
  );

  if (isGoalPastDeadline(deadline, status, today)) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      text: `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`,
      overdue: true,
    };
  }

  if (daysRemaining < 0) {
    const elapsedDays = Math.abs(daysRemaining);
    return {
      text: `Deadline passed ${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`,
      overdue: false,
    };
  }

  if (daysRemaining === 0) {
    return { text: "Due today", overdue: false };
  }

  return {
    text: `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining`,
    overdue: false,
  };
}
