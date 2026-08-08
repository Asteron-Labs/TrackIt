import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { GoalStatusBadge } from "../components/GoalStatusBadge";
import { Navigation } from "../components/Navigation";
import type { Goal, GoalResponse } from "../types/goal";

const importanceLabels = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
} as const;

export function GoalDetailsPage() {
  const { id } = useParams();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoading(true);
    setError("");
    apiRequest<GoalResponse>(`/goals/${id}`)
      .then((response) => {
        if (!requestWasCancelled) setGoal(response.goal);
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

            <section
              className="panel goal-tasks-shell"
              aria-labelledby="goal-tasks-title"
            >
              <p className="eyebrow">Tasks</p>
              <h2 id="goal-tasks-title">Work under this goal</h2>
              <p className="empty-state">No tasks yet.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
