import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { GoalStatusBadge } from "../components/GoalStatusBadge";
import { Navigation } from "../components/Navigation";
import { TaskCreationForm } from "../components/TaskCreationForm";
import { TaskList } from "../components/TaskList";
import type { Goal, GoalResponse } from "../types/goal";
import type { Task, TasksResponse } from "../types/task";

const importanceLabels = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
} as const;

export function GoalDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoading(true);
    setError("");
    Promise.all([
      apiRequest<GoalResponse>(`/goals/${id}`),
      apiRequest<TasksResponse>(`/goals/${id}/tasks`),
    ])
      .then(([goalResponse, tasksResponse]) => {
        if (!requestWasCancelled) {
          setGoal(goalResponse.goal);
          setTasks(tasksResponse.tasks);
        }
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load goal details",
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

  function addCreatedTask(task: Task): void {
    setTasks((currentTasks) =>
      [...currentTasks, task].sort(
        (first, second) =>
          first.dueDate.localeCompare(second.dueDate) ||
          first.title.localeCompare(second.title),
      ),
    );
  }

  const canCreateTasks =
    user?.role === "SUPER_ADMIN" || user?.role === "TEAM_LEAD";

  return (
    <div className="app-shell">
      <Navigation />
      <main className="goal-details-page">
        {goal ? (
          <Link className="back-link" to={`/goals?teamId=${goal.teamId}`}>
            ← Back to team goals
          </Link>
        ) : (
          <Link className="back-link" to="/goals">
            ← Back to team goals
          </Link>
        )}

        {isLoading && <p className="list-message">Loading goal details…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && goal && (
          <>
            <header className="page-heading goal-details-heading">
              <div>
                <p className="eyebrow">Goal details</p>
                <h1>{goal.title}</h1>
                <p>{goal.description || "No description provided."}</p>
              </div>
              <GoalStatusBadge status={goal.status} deadline={goal.deadline} />
            </header>

            <section
              className="goal-metadata"
              aria-label="Goal schedule and importance"
            >
              <div className="panel goal-metadata-card">
                <span>Start date</span>
                <strong>{goal.startDate}</strong>
              </div>
              <div className="panel goal-metadata-card">
                <span>Deadline</span>
                <strong>{goal.deadline}</strong>
              </div>
              <div className="panel goal-metadata-card">
                <span>Importance</span>
                <strong>{importanceLabels[goal.importance]}</strong>
              </div>
              <div className="panel goal-metadata-card">
                <span>Progress</span>
                <strong>
                  {goal.progress === null
                    ? "No tasks yet"
                    : `${Math.round(goal.progress)}%`}
                </strong>
              </div>
            </section>

            <div
              className={
                canCreateTasks
                  ? "goal-tasks-layout"
                  : "goal-tasks-layout list-only"
              }
            >
              {canCreateTasks && (
                <TaskCreationForm
                  goalId={goal.id}
                  goalDeadline={goal.deadline}
                  onCreated={addCreatedTask}
                />
              )}
              <section
                className="panel goal-tasks-shell"
                aria-labelledby="goal-tasks-title"
              >
                <div className="list-heading">
                  <div>
                    <p className="eyebrow">Tasks</p>
                    <h2 id="goal-tasks-title">Work under this goal</h2>
                  </div>
                  <span className="task-count">
                    {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                  </span>
                </div>
                <TaskList tasks={tasks} />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
