import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { TeamMemberResponse } from '../types/team';

interface UnassignedEmployee {
  id: string;
  name: string;
  email: string;
  teamId: null;
}

interface UsersResponse {
  users: UnassignedEmployee[];
}

interface TeamMemberAssignmentFormProps {
  teamId: string;
  refreshVersion: number;
  onMemberAdded: () => void;
}

export function TeamMemberAssignmentForm({
  teamId,
  refreshVersion,
  onMemberAdded,
}: TeamMemberAssignmentFormProps) {
  const [employees, setEmployees] = useState<UnassignedEmployee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoading(true);
    setError('');
    apiRequest<UsersResponse>('/users?role=EMPLOYEE&unassigned=true')
      .then((response) => {
        if (requestWasCancelled) return;
        setEmployees(response.users);
        setSelectedUserId((currentUserId) => {
          const currentUserIsAvailable = response.users.some(
            (employee) => employee.id === currentUserId,
          );
          return currentUserIsAvailable ? currentUserId : (response.users[0]?.id ?? '');
        });
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load unassigned employees',
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) setIsLoading(false);
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [refreshVersion, teamId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await apiRequest<TeamMemberResponse>(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId }),
      });
      setEmployees((currentEmployees) =>
        currentEmployees.filter((employee) => employee.id !== selectedUserId),
      );
      setSelectedUserId('');
      setSuccessMessage(`${response.member.name} was added to the team.`);
      onMemberAdded();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to add the employee');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="add-member-title">
      <div className="panel-heading">
        <p className="eyebrow">Membership</p>
        <h2 id="add-member-title">Add employee</h2>
        <p>Choose an employee who is not currently assigned to a team.</p>
      </div>

      {isLoading ? (
        <p className="list-message">Loading unassigned employees…</p>
      ) : (
        <form className="member-management-form" onSubmit={handleSubmit}>
          <label htmlFor="employee-to-add">Employee</label>
          <select
            id="employee-to-add"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={employees.length === 0 || isSubmitting}
          >
            {employees.length === 0 ? (
              <option value="">No unassigned employees</option>
            ) : (
              employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} — {employee.email}
                </option>
              ))
            )}
          </select>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {successMessage && (
            <p className="form-success" role="status">
              {successMessage}
            </p>
          )}

          <button
            className="submit-button"
            type="submit"
            disabled={!selectedUserId || isSubmitting}
          >
            {isSubmitting ? 'Adding employee…' : 'Add to team'}
          </button>
        </form>
      )}
    </section>
  );
}
