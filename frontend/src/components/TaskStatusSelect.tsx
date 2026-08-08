import { useState } from "react";
import { apiRequest } from "../api/client";
import type { Task, TaskResponse, TaskStatus } from "../types/task";

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];

interface TaskStatusSelectProps {
  taskId: string;
  taskTitle: string;
  status: TaskStatus;
  onUpdated: (task: Task) => void;
}

export function TaskStatusSelect({
  taskId,
  taskTitle,
  status,
  onUpdated,
}: TaskStatusSelectProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function changeStatus(nextStatus: TaskStatus): Promise<void> {
    setIsSaving(true);
    setError("");

    try {
      const response = await apiRequest<TaskResponse>(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      onUpdated(response.task);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update task status",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <span className="task-status-control">
      <select
        className="task-status-select"
        aria-label={`Change status for ${taskTitle}`}
        value={status}
        disabled={isSaving}
        onChange={(event) =>
          void changeStatus(event.target.value as TaskStatus)
        }
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isSaving && <small>Saving…</small>}
      {error && (
        <small className="status-update-error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}
