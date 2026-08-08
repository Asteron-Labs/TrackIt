import type { TaskPriority, TaskStatus } from "../types/task";

const statusLabels: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Low priority",
  MEDIUM: "Medium priority",
  HIGH: "High priority",
};

interface TaskStatusBadgesProps {
  status: TaskStatus;
  priority: TaskPriority;
  overdue: boolean;
}

export function TaskStatusBadges({
  status,
  priority,
  overdue,
}: TaskStatusBadgesProps) {
  return (
    <span className="task-badges">
      <span className={`task-status-badge task-status-${status.toLowerCase()}`}>
        {statusLabels[status]}
      </span>
      <span
        className={`task-priority-badge task-priority-${priority.toLowerCase()}`}
      >
        {priorityLabels[priority]}
      </span>
      {overdue && <span className="overdue-marker">Overdue</span>}
    </span>
  );
}
