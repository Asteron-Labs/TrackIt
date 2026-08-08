import { FormEvent, useState } from "react";
import { apiRequest } from "../api/client";
import type { LogTimeRequest, LogTimeResponse } from "../types/timesheet";

interface LogTimeFormProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

interface FieldErrors {
  workDate?: string;
  hoursSpent?: string;
}

function localToday(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LogTimeForm({ taskId, taskTitle, onClose }: LogTimeFormProps) {
  const today = localToday();
  const [workDate, setWorkDate] = useState(today);
  const [hoursSpent, setHoursSpent] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateFields(): FieldErrors {
    const errors: FieldErrors = {};
    const numericHours = Number(hoursSpent);

    if (!workDate) {
      errors.workDate = "Choose a work date.";
    } else if (workDate > today) {
      errors.workDate = "Work date cannot be in the future.";
    }

    if (!hoursSpent) {
      errors.hoursSpent = "Enter the hours spent.";
    } else if (!Number.isFinite(numericHours) || numericHours <= 0) {
      errors.hoursSpent = "Hours spent must be greater than zero.";
    }

    return errors;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const errors = validateFields();
    setFieldErrors(errors);
    setFormError("");
    setSuccessMessage("");
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const request: LogTimeRequest = {
      taskId,
      workDate,
      hoursSpent: Number(hoursSpent),
      workNote: workNote.trim() || undefined,
    };

    try {
      const response = await apiRequest<LogTimeResponse>("/timesheets", {
        method: "POST",
        body: JSON.stringify(request),
      });
      setHoursSpent("");
      setWorkNote("");
      setSuccessMessage(
        `Time logged. Your total for ${workDate} is ${response.dailyTotalHours}h.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log time";
      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes("hour") ||
        lowerMessage.includes("daily total")
      ) {
        setFieldErrors({ hoursSpent: message });
      } else if (lowerMessage.includes("date")) {
        setFieldErrors({ workDate: message });
      } else {
        setFormError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="log-time-panel">
      <div className="log-time-heading">
        <div>
          <p className="eyebrow">Record effort</p>
          <h3>Log time for {taskTitle}</h3>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="log-time-form" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor={`log-time-date-${taskId}`}>Work date</label>
          <input
            id={`log-time-date-${taskId}`}
            name="workDate"
            type="date"
            max={today}
            value={workDate}
            aria-invalid={Boolean(fieldErrors.workDate)}
            aria-describedby={
              fieldErrors.workDate ? `log-time-date-error-${taskId}` : undefined
            }
            onChange={(event) => {
              setWorkDate(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                workDate: undefined,
              }));
            }}
          />
          {fieldErrors.workDate && (
            <p
              className="field-error"
              id={`log-time-date-error-${taskId}`}
              role="alert"
            >
              {fieldErrors.workDate}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`log-time-hours-${taskId}`}>Hours spent</label>
          <input
            id={`log-time-hours-${taskId}`}
            name="hoursSpent"
            type="number"
            min="0.01"
            step="any"
            value={hoursSpent}
            aria-invalid={Boolean(fieldErrors.hoursSpent)}
            aria-describedby={
              fieldErrors.hoursSpent
                ? `log-time-hours-error-${taskId}`
                : undefined
            }
            onChange={(event) => {
              setHoursSpent(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                hoursSpent: undefined,
              }));
            }}
          />
          {fieldErrors.hoursSpent && (
            <p
              className="field-error"
              id={`log-time-hours-error-${taskId}`}
              role="alert"
            >
              {fieldErrors.hoursSpent}
            </p>
          )}
        </div>

        <div className="log-time-note-field">
          <label htmlFor={`log-time-note-${taskId}`}>Work note</label>
          <textarea
            id={`log-time-note-${taskId}`}
            name="workNote"
            rows={3}
            value={workNote}
            onChange={(event) => setWorkNote(event.target.value)}
          />
        </div>

        {formError && (
          <p className="form-error log-time-message" role="alert">
            {formError}
          </p>
        )}
        {successMessage && (
          <p className="form-success log-time-message" role="status">
            {successMessage}
          </p>
        )}

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging time…" : "Log time"}
        </button>
      </form>
    </div>
  );
}
