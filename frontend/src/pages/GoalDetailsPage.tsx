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
import type { TeamDetailsResponse, TeamMember } from "../types/team";

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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let requestWasCancelled = false;

    async function loadGoalDetails(): Promise<void> {
      setIsLoading(true);
      setError("");

      try {
        const [goalResponse, tasksResponse] = await Promise.all([
          apiRequest<GoalResponse>(`/goals/${id}`),
          apiRequest<TasksResponse>(`/goals/${id}/tasks`),
        ]);
        let members: TeamMember[] = [];
        if (user?.role === "TEAM_LEAD") {
          const teamResponse = await apiRequest<TeamDetailsResponse>(
            `/teams/${goalResponse.goal.teamId}`,
          );
          members = teamResponse.team.members;
        }

        if (!requestWasCancelled) {
          setGoal(goalResponse.goal);
          setTasks(tasksResponse.tasks);
          setTeamMembers(members);
        }
      } catch (requestError) {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load goal details",
          );
        }
      } finally {
        if (!requestWasCancelled) setIsLoading(false);
      }
    }

    void loadGoalDetails();

    return () => {
      requestWasCancelled = true;
    };
  }, [id, user?.role]);

  function addCreatedTask(task: Task): void {
    setTasks((currentTasks) =>
      [...currentTasks, task].sort(
        (first, second) =>
          first.dueDate.localeCompare(second.dueDate) ||
          first.title.localeCompare(second.title),
      ),
    );
  }

  function replaceTask(updatedTask: Task): void {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === updatedTask.id ? updatedTask : task,
      ),
    );
  }

  const canCreateTasks =
    user?.role === "SUPER_ADMIN" || user?.role === "TEAM_LEAD";
  const canAssignTasks = user?.role === "TEAM_LEAD";

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
                  members={teamMembers}
                  canAssign={canAssignTasks}
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
                <TaskList
                  tasks={tasks}
                  members={teamMembers}
                  canAssign={canAssignTasks}
                  onAssignmentChanged={replaceTask}
                />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
