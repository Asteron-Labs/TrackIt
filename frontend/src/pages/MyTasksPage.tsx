import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { Navigation } from "../components/Navigation";
import { LogTimeForm } from "../components/LogTimeForm";
import { type MyTaskSort, sortMyTasks } from "../components/my-task-sorting";
import { TaskStatusBadges } from "../components/TaskStatusBadges";
import { TaskStatusSelect } from "../components/TaskStatusSelect";
import type { MyTask, MyTasksResponse, Task, TaskStatus } from "../types/task";

export function MyTasksPage() {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [dueBefore, setDueBefore] = useState("");
  const [sort, setSort] = useState<MyTaskSort>("DEADLINE");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingTaskId, setLoggingTaskId] = useState<string | null>(null);

  useEffect(() => {
    let requestWasCancelled = false;

    async function loadMyTasks(): Promise<void> {
      setIsLoading(true);
      setError("");

      const query = new URLSearchParams();
      if (statusFilter) query.set("status", statusFilter);
      if (dueBefore) query.set("dueBefore", dueBefore);
      const queryString = query.toString();

      try {
        const response = await apiRequest<MyTasksResponse>(
          `/tasks/mine${queryString ? `?${queryString}` : ""}`,
        );
        if (!requestWasCancelled) setTasks(response.tasks);
      } catch (requestError) {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load your tasks",
          );
        }
      } finally {
        if (!requestWasCancelled) setIsLoading(false);
      }
    }

    void loadMyTasks();

    return () => {
      requestWasCancelled = true;
    };
  }, [dueBefore, statusFilter]);

  function applyStatusUpdate(updatedTask: Task): void {
    setTasks((currentTasks) => {
      if (statusFilter && updatedTask.status !== statusFilter) {
        return currentTasks.filter((task) => task.id !== updatedTask.id);
      }

      return currentTasks.map((task) =>
        task.id === updatedTask.id
          ? {
              ...task,
              status: updatedTask.status,
              overdue: updatedTask.overdue,
            }
          : task,
      );
    });
  }

  const sortedTasks = sortMyTasks(tasks, sort);
  const filtersAreActive = statusFilter !== "" || dueBefore !== "";

  return (
    <div className="app-shell">
      <Navigation />
      <main className="my-tasks-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">My work</p>
            <h1>My Tasks</h1>
            <p>Everything assigned to you, in one place.</p>
          </div>
        </header>

        <section
          className="panel my-tasks-panel"
          aria-labelledby="my-tasks-title"
        >
          <div className="my-task-controls">
            <div>
              <label htmlFor="my-task-status-filter">Status</label>
              <select
                id="my-task-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as TaskStatus | "")
                }
              >
                <option value="">All statuses</option>
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
              </select>
            </div>
            <div>
              <label htmlFor="my-task-due-before">Due before</label>
              <input
                id="my-task-due-before"
                type="date"
                value={dueBefore}
                onChange={(event) => setDueBefore(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="my-task-sort">Sort by</label>
              <select
                id="my-task-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as MyTaskSort)}
              >
                <option value="DEADLINE">Deadline — soonest first</option>
                <option value="PRIORITY">Priority — highest first</option>
              </select>
            </div>
          </div>

          {isLoading && <p className="list-message">Loading your tasks…</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {!isLoading && !error && sortedTasks.length === 0 && (
            <p className="empty-state">
              {filtersAreActive
                ? "No assigned tasks match these filters."
                : "You have no assigned work."}
            </p>
          )}

          {!isLoading && !error && sortedTasks.length > 0 && (
            <div className="table-wrapper">
              <table className="tasks-table my-tasks-table">
                <thead>
                  <tr>
                    <th id="my-tasks-title" scope="col">
                      Task
                    </th>
                    <th scope="col">Parent goal</th>
                    <th scope="col">Deadline</th>
                    <th scope="col">Status and priority</th>
                    <th scope="col">Estimate</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => (
                    <Fragment key={task.id}>
                      <tr className={task.overdue ? "overdue-task-row" : ""}>
                        <td>
                          <Link className="task-link" to={`/tasks/${task.id}`}>
                            {task.title}
                          </Link>
                        </td>
                        <td>
                          <Link
                            className="goal-link"
                            to={`/goals/${task.goal.id}`}
                          >
                            {task.goal.title}
                          </Link>
                        </td>
                        <td>{task.dueDate}</td>
                        <td>
                          <div className="my-task-status-cell">
                            <TaskStatusBadges
                              status={task.status}
                              priority={task.priority}
                              overdue={task.overdue}
                            />
                            <TaskStatusSelect
                              taskId={task.id}
                              taskTitle={task.title}
                              status={task.status}
                              onUpdated={applyStatusUpdate}
                            />
                          </div>
                        </td>
                        <td>{task.estimatedHours}h</td>
                        <td>
                          <button
                            className="secondary-button log-time-action"
                            type="button"
                            aria-expanded={loggingTaskId === task.id}
                            onClick={() =>
                              setLoggingTaskId((currentTaskId) =>
                                currentTaskId === task.id ? null : task.id,
                              )
                            }
                          >
                            Log Time
                          </button>
                        </td>
                      </tr>
                      {loggingTaskId === task.id && (
                        <tr className="log-time-row">
                          <td colSpan={6}>
                            <LogTimeForm
                              taskId={task.id}
                              taskTitle={task.title}
                              onClose={() => setLoggingTaskId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
