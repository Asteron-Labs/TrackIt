import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AssigneeSelect } from "../components/AssigneeSelect";
import { Navigation } from "../components/Navigation";
import { TaskStatusBadges } from "../components/TaskStatusBadges";
import type { GoalResponse } from "../types/goal";
import type { Task, TaskResponse } from "../types/task";
import type { TeamDetailsResponse, TeamMember } from "../types/team";

export function TaskDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAssignee, setIsSavingAssignee] = useState(false);
  const [error, setError] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    let requestWasCancelled = false;

    async function loadTaskDetails(): Promise<void> {
      setIsLoading(true);
      setError("");

      try {
        const taskResponse = await apiRequest<TaskResponse>(`/tasks/${id}`);
        let members: TeamMember[] = [];
        if (user?.role === "TEAM_LEAD") {
          const goalResponse = await apiRequest<GoalResponse>(
            `/goals/${taskResponse.task.goalId}`,
          );
          const teamResponse = await apiRequest<TeamDetailsResponse>(
            `/teams/${goalResponse.goal.teamId}`,
          );
          members = teamResponse.team.members;
        }

        if (!requestWasCancelled) {
          setTask(taskResponse.task);
          setTeamMembers(members);
        }
      } catch (requestError) {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load task details",
          );
        }
      } finally {
        if (!requestWasCancelled) setIsLoading(false);
      }
    }

    void loadTaskDetails();

    return () => {
      requestWasCancelled = true;
    };
  }, [id, user?.role]);

  async function updateAssignee(assigneeId: string | null): Promise<void> {
    if (!task) return;

    setIsSavingAssignee(true);
    setAssignmentError("");
    try {
      const response = await apiRequest<TaskResponse>(
        `/tasks/${task.id}/assignee`,
        {
          method: "PUT",
          body: JSON.stringify({ assigneeId }),
        },
      );
      setTask(response.task);
    } catch (requestError) {
      setAssignmentError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update assignee",
      );
    } finally {
      setIsSavingAssignee(false);
    }
  }

  const canAssignTask = user?.role === "TEAM_LEAD";

  return (
    <div className="app-shell">
      <Navigation />
      <main className="task-details-page">
        {task ? (
          <Link className="back-link" to={`/goals/${task.goalId}`}>
            ← Back to goal
          </Link>
        ) : (
          <Link className="back-link" to="/goals">
            ← Back to goals
          </Link>
        )}

        {isLoading && <p className="list-message">Loading task details…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && task && (
          <>
            <header className="page-heading task-details-heading">
              <div>
                <p className="eyebrow">Task details</p>
                <h1>{task.title}</h1>
                <p>{task.description || "No description provided."}</p>
              </div>
              <TaskStatusBadges
                status={task.status}
                priority={task.priority}
                overdue={task.overdue}
              />
            </header>

            {task.dueDatePastGoalDeadline && (
              <p className="detail-warning" role="status">
                This task is due after its parent goal deadline.
              </p>
            )}

            <section
              className="task-metadata"
              aria-label="Task assignment, schedule, and estimate"
            >
              <div className="panel task-metadata-card">
                <span>Assignee</span>
                <strong>
                  {task.assignee ? task.assignee.name : "Unassigned"}
                </strong>
                {canAssignTask && (
                  <div className="task-detail-assignment-controls">
                    <AssigneeSelect
                      id="task-detail-assignee"
                      value={task.assigneeId}
                      members={teamMembers}
                      ariaLabel={`Assign ${task.title}`}
                      disabled={isSavingAssignee}
                      onChange={(assigneeId) =>
                        void updateAssignee(assigneeId)
                      }
                    />
                    {task.assigneeId && (
                      <button
                        className="secondary-button unassign-button"
                        type="button"
                        disabled={isSavingAssignee}
                        onClick={() => void updateAssignee(null)}
                      >
                        Unassign task
                      </button>
                    )}
                  </div>
                )}
                {assignmentError && (
                  <span className="assignment-error" role="alert">
                    {assignmentError}
                  </span>
                )}
              </div>
              <div className="panel task-metadata-card">
                <span>Due date</span>
                <strong>{task.dueDate}</strong>
              </div>
              <div className="panel task-metadata-card">
                <span>Estimated effort</span>
                <strong>{task.estimatedHours} hours</strong>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
