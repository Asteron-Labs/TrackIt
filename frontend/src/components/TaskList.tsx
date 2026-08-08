import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import type { Task, TaskResponse } from "../types/task";
import type { TeamMember } from "../types/team";
import { AssigneeSelect } from "./AssigneeSelect";
import { TaskStatusBadges } from "./TaskStatusBadges";
import { TaskStatusSelect } from "./TaskStatusSelect";

interface TaskListProps {
  tasks: Task[];
  members: TeamMember[];
  canAssign: boolean;
  canChangeStatus: boolean;
  onTaskChanged: (task: Task) => void;
  onTaskStatusChanged: (task: Task) => void;
}

export function TaskList({
  tasks,
  members,
  canAssign,
  canChangeStatus,
  onTaskChanged,
  onTaskStatusChanged,
}: TaskListProps) {
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [assignmentErrors, setAssignmentErrors] = useState<
    Record<string, string>
  >({});

  async function changeAssignee(
    taskId: string,
    assigneeId: string | null,
  ): Promise<void> {
    setSavingTaskId(taskId);
    setAssignmentErrors((currentErrors) => ({
      ...currentErrors,
      [taskId]: "",
    }));

    try {
      const response = await apiRequest<TaskResponse>(
        `/tasks/${taskId}/assignee`,
        {
          method: "PUT",
          body: JSON.stringify({ assigneeId }),
        },
      );
      onTaskChanged(response.task);
    } catch (error) {
      setAssignmentErrors((currentErrors) => ({
        ...currentErrors,
        [taskId]:
          error instanceof Error ? error.message : "Unable to update assignee",
      }));
    } finally {
      setSavingTaskId(null);
    }
  }

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
                <div className="my-task-status-cell">
                  <TaskStatusBadges
                    status={task.status}
                    priority={task.priority}
                    overdue={task.overdue}
                  />
                  {canChangeStatus && (
                    <TaskStatusSelect
                      taskId={task.id}
                      taskTitle={task.title}
                      status={task.status}
                      onUpdated={onTaskStatusChanged}
                    />
                  )}
                </div>
              </td>
              <td>
                <div className="task-assignment-cell">
                  {task.assignee ? (
                    <div className="assignee-identity">
                      <span className="assignee-avatar" aria-hidden="true">
                        {task.assignee.name.charAt(0).toUpperCase()}
                      </span>
                      <span>{task.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="unassigned-label">Unassigned</span>
                  )}
                  {canAssign && (
                    <AssigneeSelect
                      id={`task-${task.id}-assignee`}
                      value={task.assigneeId}
                      members={members}
                      ariaLabel={`Assign ${task.title}`}
                      disabled={savingTaskId !== null}
                      onChange={(assigneeId) =>
                        void changeAssignee(task.id, assigneeId)
                      }
                    />
                  )}
                  {assignmentErrors[task.id] && (
                    <span className="assignment-error" role="alert">
                      {assignmentErrors[task.id]}
                    </span>
                  )}
                </div>
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
