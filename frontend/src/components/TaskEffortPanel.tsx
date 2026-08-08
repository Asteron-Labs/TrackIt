import type { TaskEffort } from '../types/timesheet';

interface TaskEffortPanelProps {
  effort: TaskEffort;
}

const varianceLabels: Record<TaskEffort['varianceStatus'], string> = {
  UNDER_ESTIMATE: 'Under estimate',
  ON_ESTIMATE: 'On estimate',
  OVER_ESTIMATE: 'Over estimate',
  OVERRUN: 'Overrun',
};

function formatHours(hours: number): string {
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: 2 })} hours`;
}

export function TaskEffortPanel({ effort }: TaskEffortPanelProps) {
  const consumedPercent =
    effort.estimatedHours === 0 ? null : (effort.actualHours / effort.estimatedHours) * 100;
  const progressWidth = Math.min(consumedPercent ?? 0, 100);
  const isOverEstimate = effort.actualHours > effort.estimatedHours;
  const varianceClass = effort.varianceStatus.toLowerCase().replace('_', '-');
  const variancePrefix = effort.variance > 0 ? '+' : '';

  return (
    <section className="panel task-effort-panel" aria-labelledby="task-effort-title">
      <div className="panel-heading">
        <p className="eyebrow">Recorded effort</p>
        <h2 id="task-effort-title">Estimated versus actual</h2>
        <p>Compare the estimate with every time entry recorded against this task.</p>
      </div>

      <div className="effort-summary">
        <div>
          <span>Estimated</span>
          <strong>{formatHours(effort.estimatedHours)}</strong>
        </div>
        <div>
          <span>Actual</span>
          <strong>{formatHours(effort.actualHours)}</strong>
        </div>
        <div className={`effort-variance effort-variance-${varianceClass}`}>
          <span>Variance</span>
          <strong>
            {variancePrefix}
            {formatHours(effort.variance)}
          </strong>
          <small>{varianceLabels[effort.varianceStatus]}</small>
        </div>
      </div>

      <div className={`effort-progress ${isOverEstimate ? 'effort-progress-over' : ''}`}>
        <div className="effort-progress-heading">
          <span>Estimate consumed</span>
          <strong>
            {consumedPercent === null ? 'No estimate' : `${consumedPercent.toFixed(1)}%`}
          </strong>
        </div>
        <div
          className="effort-progress-track"
          role="progressbar"
          aria-label="Estimate consumed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressWidth}
          aria-valuetext={
            consumedPercent === null
              ? 'No estimate available'
              : `${consumedPercent.toFixed(1)} percent consumed`
          }
        >
          <span style={{ width: `${progressWidth}%` }} />
        </div>
      </div>

      <div className="effort-entries">
        <h3>Contributing entries</h3>
        {effort.entries.length === 0 ? (
          <p className="empty-state">No time has been recorded against this task.</p>
        ) : (
          <div className="table-wrapper">
            <table className="effort-entries-table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Work date</th>
                  <th scope="col">Hours</th>
                  <th scope="col">Work note</th>
                </tr>
              </thead>
              <tbody>
                {effort.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.employee.name}</td>
                    <td>{entry.workDate}</td>
                    <td>{entry.hoursSpent}</td>
                    <td>{entry.workNote || 'No work note'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
