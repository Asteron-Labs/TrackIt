import { FormEvent, useState } from 'react';
import { ApiError, apiRequest } from '../api/client';
import type { TeamResponse } from '../types/team';

interface TeamCreationFormProps {
  onCreated: () => void;
}

export function TeamCreationForm({ onCreated }: TeamCreationFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState('40');
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setNameError('');
    setFormError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      await apiRequest<TeamResponse>('/teams', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          weeklyCapacityHours: Number(weeklyCapacityHours),
        }),
      });
      setName('');
      setDescription('');
      setWeeklyCapacityHours('40');
      setSuccessMessage('Team created successfully.');
      onCreated();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNameError(error.message);
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Unable to create the team',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="panel team-form-panel"
      aria-labelledby="create-team-title"
    >
      <div className="panel-heading">
        <p className="eyebrow">Company structure</p>
        <h2 id="create-team-title">Create team</h2>
        <p>Create the team first. A lead and members can be assigned later.</p>
      </div>

      <form className="team-form" onSubmit={handleSubmit}>
        <label htmlFor="team-name">Name</label>
        <input
          id="team-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameError('');
          }}
          aria-invalid={nameError ? 'true' : undefined}
          aria-describedby={nameError ? 'team-name-error' : undefined}
          required
        />
        {nameError && (
          <p id="team-name-error" className="field-error" role="alert">
            {nameError}
          </p>
        )}

        <label htmlFor="team-description">Description</label>
        <textarea
          id="team-description"
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <label htmlFor="team-capacity">Weekly capacity hours</label>
        <input
          id="team-capacity"
          name="weeklyCapacityHours"
          type="number"
          min="0.1"
          step="0.1"
          value={weeklyCapacityHours}
          onChange={(event) => setWeeklyCapacityHours(event.target.value)}
          required
        />
        <small className="field-hint">Defaults to 40 hours per week.</small>

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
          {isSubmitting ? 'Creating team…' : 'Create team'}
        </button>
      </form>
    </section>
  );
}
