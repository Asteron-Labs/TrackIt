import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { TeamLeadResponse, TeamMember } from '../types/team';

interface TeamLeadSelectorProps {
  teamId: string;
  members: TeamMember[];
  currentLead: TeamMember | null;
  onLeadAssigned: () => void;
}

export function TeamLeadSelector({
  teamId,
  members,
  currentLead,
  onLeadAssigned,
}: TeamLeadSelectorProps) {
  const [selectedUserId, setSelectedUserId] = useState(currentLead?.id ?? members[0]?.id ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedUserId(currentLead?.id ?? members[0]?.id ?? '');
    setError('');
  }, [currentLead?.id, members]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const selectedMember = members.find((member) => member.id === selectedUserId);
    if (!selectedMember || selectedMember.id === currentLead?.id) return;

    if (currentLead) {
      const replacementWasConfirmed = window.confirm(
        `Assign ${selectedMember.name} as team lead? ${currentLead.name} will be demoted to Employee.`,
      );
      if (!replacementWasConfirmed) return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await apiRequest<TeamLeadResponse>(`/teams/${teamId}/lead`, {
        method: 'PUT',
        body: JSON.stringify({ userId: selectedUserId }),
      });
      onLeadAssigned();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to assign the team lead',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="team-lead-title">
      <div className="panel-heading">
        <p className="eyebrow">Leadership</p>
        <h2 id="team-lead-title">Team lead</h2>
        {currentLead ? (
          <div className="person-summary">
            <strong>{currentLead.name}</strong>
            <span>{currentLead.email}</span>
          </div>
        ) : (
          <p className="empty-state">No lead assigned.</p>
        )}
      </div>

      <form className="member-management-form" onSubmit={handleSubmit}>
        <label htmlFor="team-lead-selector">Assign lead</label>
        <select
          id="team-lead-selector"
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          disabled={members.length === 0 || isSubmitting}
        >
          {members.length === 0 ? (
            <option value="">Add a member first</option>
          ) : (
            members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))
          )}
        </select>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="submit-button"
          type="submit"
          disabled={!selectedUserId || selectedUserId === currentLead?.id || isSubmitting}
        >
          {isSubmitting ? 'Assigning lead…' : 'Assign team lead'}
        </button>
      </form>
    </section>
  );
}
