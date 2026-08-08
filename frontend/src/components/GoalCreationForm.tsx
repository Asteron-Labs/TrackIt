import { FormEvent, useState } from "react";
import { apiRequest } from "../api/client";
import type { GoalImportance, GoalResponse } from "../types/goal";

interface GoalCreationFormProps {
  teamId: string;
  onCreated: () => void;
}

export function GoalCreationForm({ teamId, onCreated }: GoalCreationFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [importance, setImportance] = useState<GoalImportance>("MEDIUM");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await apiRequest<GoalResponse>("/goals", {
        method: "POST",
        body: JSON.stringify({
          teamId,
          title,
          description,
          startDate,
          deadline,
          importance,
        }),
      });
      setTitle("");
      setDescription("");
      setStartDate("");
      setDeadline("");
      setImportance("MEDIUM");
      setSuccessMessage("Goal created successfully.");
      onCreated();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create the goal",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="panel goal-form-panel"
      aria-labelledby="create-goal-title"
    >
      <div className="panel-heading">
        <p className="eyebrow">Team direction</p>
        <h2 id="create-goal-title">Create goal</h2>
        <p>Give the team a clear outcome and delivery window.</p>
      </div>

      <form className="goal-form" onSubmit={handleSubmit}>
        <label htmlFor="goal-title">Title</label>
        <input
          id="goal-title"
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <label htmlFor="goal-description">Description</label>
        <textarea
          id="goal-description"
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="goal-date-fields">
          <div>
            <label htmlFor="goal-start-date">Start date</label>
            <input
              id="goal-start-date"
              name="startDate"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="goal-deadline">Deadline</label>
            <input
              id="goal-deadline"
              name="deadline"
              type="date"
              min={startDate || undefined}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              required
            />
          </div>
        </div>

        <label htmlFor="goal-importance">Importance</label>
        <select
          id="goal-importance"
          name="importance"
          value={importance}
          onChange={(event) =>
            setImportance(event.target.value as GoalImportance)
          }
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>

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

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating goal…" : "Create goal"}
        </button>
      </form>
    </section>
  );
}
