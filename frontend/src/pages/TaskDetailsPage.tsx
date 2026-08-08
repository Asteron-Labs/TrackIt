import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { Navigation } from "../components/Navigation";
import { TaskStatusBadges } from "../components/TaskStatusBadges";
import type { Task, TaskResponse } from "../types/task";

export function TaskDetailsPage() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoading(true);
    setError("");
    apiRequest<TaskResponse>(`/tasks/${id}`)
      .then((response) => {
        if (!requestWasCancelled) setTask(response.task);
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load task details",
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) setIsLoading(false);
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [id]);

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
