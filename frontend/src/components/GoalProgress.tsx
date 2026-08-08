import type { GoalTaskStatusBreakdown } from "../types/goal";

interface GoalProgressProps {
  progress: number;
  noTasksYet: boolean;
  breakdown: GoalTaskStatusBreakdown;
  compact?: boolean;
}

export function GoalProgress({
  progress,
  noTasksYet,
  breakdown,
  compact = false,
}: GoalProgressProps) {
  if (noTasksYet) {
    return <p className="goal-progress-empty">No tasks yet</p>;
  }

  const roundedProgress = Math.round(progress);

  return (
    <div className={compact ? "goal-progress compact" : "goal-progress"}>
      <div className="goal-progress-heading">
        <strong>{roundedProgress}%</strong>
        <span>
          {breakdown.done} of {breakdown.total} done
        </span>
      </div>
      <div
        className="goal-progress-track"
        role="progressbar"
        aria-label="Goal progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedProgress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <dl className="goal-task-breakdown">
        <div>
          <dt>Total</dt>
          <dd>{breakdown.total}</dd>
        </div>
        <div>
          <dt>Done</dt>
          <dd>{breakdown.done}</dd>
        </div>
        <div>
          <dt>In progress</dt>
          <dd>{breakdown.inProgress}</dd>
        </div>
        <div>
          <dt>Blocked</dt>
          <dd>{breakdown.blocked}</dd>
        </div>
        <div>
          <dt>To do</dt>
          <dd>{breakdown.todo}</dd>
        </div>
      </dl>
    </div>
  );
}
