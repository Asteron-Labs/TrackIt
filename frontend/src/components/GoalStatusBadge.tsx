import type { GoalStatus } from "../types/goal";
import { goalStatusLabels, isGoalPastDeadline } from "./goal-display";

interface GoalStatusBadgeProps {
  status: GoalStatus;
  deadline: string;
}

export function GoalStatusBadge({ status, deadline }: GoalStatusBadgeProps) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${now.getFullYear()}-${month}-${day}`;
  const isPastDeadline = isGoalPastDeadline(deadline, status, today);

  return (
    <span className="goal-status-summary">
      <span className={`goal-status-badge goal-status-${status.toLowerCase()}`}>
        {goalStatusLabels[status]}
      </span>
      {isPastDeadline && <span className="overdue-marker">Past deadline</span>}
    </span>
  );
}
