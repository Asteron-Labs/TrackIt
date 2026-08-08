import { FormEvent, useState } from "react";
import { apiRequest } from "../api/client";
import type { Task, TaskPriority, TaskResponse } from "../types/task";

interface TaskCreationFormProps {
  goalId: string;
  goalDeadline: string;
  onCreated: (task: Task) => void;
}

export function TaskCreationForm({
  goalId,
  goalDeadline,
  onCreated,
}: TaskCreationFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [createdWithDeadlineWarning, setCreatedWithDeadlineWarning] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dueDatePastGoalDeadline = Boolean(dueDate && dueDate > goalDeadline);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setCreatedWithDeadlineWarning(false);
    setIsSubmitting(true);

    try {
      const response = await apiRequest<TaskResponse>(
        `/goals/${goalId}/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            description,
            priority,
            estimatedHours: Number(estimatedHours),
            dueDate,
          }),
        },
      );
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setEstimatedHours("");
      setDueDate("");
      setSuccessMessage("Task created successfully.");
      setCreatedWithDeadlineWarning(response.task.dueDatePastGoalDeadline);
      onCreated(response.task);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create the task",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="panel task-form-panel"
      aria-labelledby="create-task-title"
    >
      <div className="panel-heading">
        <p className="eyebrow">Break down the goal</p>
        <h2 id="create-task-title">Create task</h2>
        <p>Add a clear unit of work with an effort estimate and deadline.</p>
      </div>

      <form className="task-form" onSubmit={handleSubmit}>
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <label htmlFor="task-priority">Priority</label>
        <select
          id="task-priority"
          name="priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>

        <div className="task-number-date-fields">
          <div>
            <label htmlFor="task-estimated-hours">Estimated hours</label>
            <input
              id="task-estimated-hours"
              name="estimatedHours"
              type="number"
              min="0.25"
              step="0.25"
              value={estimatedHours}
              onChange={(event) => setEstimatedHours(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="task-due-date">Due date</label>
            <input
              id="task-due-date"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </div>
        </div>

        {dueDatePastGoalDeadline && (
          <p className="form-warning" role="status">
            This due date is after the goal deadline of {goalDeadline}. You can
            still create the task.
          </p>
        )}
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        {successMessage && (
          <p className="form-success" role="status">
            {successMessage}
          </p>
        )}
        {createdWithDeadlineWarning && (
          <p className="form-warning" role="status">
            The task was created, but its due date is after the goal deadline.
          </p>
        )}

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating task…" : "Create task"}
        </button>
      </form>
    </section>
  );
}
