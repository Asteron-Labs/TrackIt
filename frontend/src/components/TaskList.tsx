import { Link } from "react-router-dom";
import type { Task } from "../types/task";
import { TaskStatusBadges } from "./TaskStatusBadges";

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="empty-state">No tasks yet.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="tasks-table">
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">Status and priority</th>
            <th scope="col">Assignee</th>
            <th scope="col">Due date</th>
            <th scope="col">Estimate</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <Link className="task-link" to={`/tasks/${task.id}`}>
                  {task.title}
                </Link>
              </td>
              <td>
                <TaskStatusBadges
                  status={task.status}
                  priority={task.priority}
                  overdue={task.overdue}
                />
              </td>
              <td>
                {task.assignee ? (
                  task.assignee.name
                ) : (
                  <span className="unassigned-label">Unassigned</span>
                )}
              </td>
              <td>
                <span>{task.dueDate}</span>
                {task.dueDatePastGoalDeadline && (
                  <span className="table-warning">After goal deadline</span>
                )}
              </td>
              <td>{task.estimatedHours}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
