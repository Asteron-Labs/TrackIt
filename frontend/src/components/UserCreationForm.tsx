import { FormEvent, useState } from 'react';
import { ApiError, apiRequest } from '../api/client';
import { UserRole } from '../types/auth';
import { roleLabels } from './role-navigation';

interface UserCreationFormProps {
  onCreated: () => void;
}

const roleOptions = Object.entries(roleLabels) as [UserRole, string][];

export function UserCreationForm({ onCreated }: UserCreationFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setEmailError('');
    setFormError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      await apiRequest<unknown>('/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      setName('');
      setEmail('');
      setPassword('');
      setRole('EMPLOYEE');
      setSuccessMessage('User account created successfully.');
      onCreated();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setEmailError(error.message);
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Unable to create the user',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="panel user-form-panel"
      aria-labelledby="create-user-title"
    >
      <div className="panel-heading">
        <p className="eyebrow">New account</p>
        <h2 id="create-user-title">Create user</h2>
        <p>Set the user&apos;s initial credentials and company role.</p>
      </div>

      <form className="user-form" onSubmit={handleSubmit}>
        <label htmlFor="user-name">Name</label>
        <input
          id="user-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <label htmlFor="user-email">Email</label>
        <input
          id="user-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError('');
          }}
          aria-invalid={emailError ? 'true' : undefined}
          aria-describedby={emailError ? 'user-email-error' : undefined}
          required
        />
        {emailError && (
          <p id="user-email-error" className="field-error" role="alert">
            {emailError}
          </p>
        )}

        <label htmlFor="user-password">Initial password</label>
        <input
          id="user-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={4}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <small className="field-hint">At least 4 characters.</small>

        <label htmlFor="user-role">Role</label>
        <select
          id="user-role"
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
        >
          {roleOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
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
          {isSubmitting ? 'Creating user…' : 'Create user'}
        </button>
      </form>
    </section>
  );
}
