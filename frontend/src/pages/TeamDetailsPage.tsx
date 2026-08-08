import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Navigation } from '../components/Navigation';
import { roleLabels } from '../components/role-navigation';
import type { TeamDetails, TeamDetailsResponse } from '../types/team';

export function TeamDetailsPage() {
  const { id } = useParams();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoading(true);
    setError('');
    apiRequest<TeamDetailsResponse>(`/teams/${id}`)
      .then((response) => {
        if (!requestWasCancelled) setTeam(response.team);
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load team details',
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) setIsLoading(false);
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [id]);

  return (
    <div className="app-shell">
      <Navigation />
      <main className="team-details-page">
        <Link className="back-link" to="/teams">
          ← Back to teams
        </Link>

        {isLoading && <p className="list-message">Loading team details…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && team && (
          <>
            <header className="page-heading team-details-heading">
              <div>
                <p className="eyebrow">Team details</p>
                <h1>{team.name}</h1>
                <p>{team.description || 'No description provided.'}</p>
              </div>
              <div className="capacity-summary">
                <strong>{team.weeklyCapacityHours}</strong>
                <span>hours weekly capacity</span>
              </div>
            </header>

            <div className="team-details-grid">
              <section className="panel" aria-labelledby="team-lead-title">
                <p className="eyebrow">Leadership</p>
                <h2 id="team-lead-title">Current lead</h2>
                {team.lead ? (
                  <div className="person-summary">
                    <strong>{team.lead.name}</strong>
                    <span>{team.lead.email}</span>
                  </div>
                ) : (
                  <p className="empty-state">No lead assigned.</p>
                )}
              </section>

              <section
                className="panel members-panel"
                aria-labelledby="members-title"
              >
                <div className="list-heading">
                  <div>
                    <p className="eyebrow">Membership</p>
                    <h2 id="members-title">Members</h2>
                  </div>
                  <span className="member-count">
                    {team.memberCount}{' '}
                    {team.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>

                {team.members.length === 0 ? (
                  <p className="empty-state">This team has no members yet.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="members-table">
                      <thead>
                        <tr>
                          <th scope="col">Name</th>
                          <th scope="col">Email</th>
                          <th scope="col">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.members.map((member) => (
                          <tr key={member.id}>
                            <td>{member.name}</td>
                            <td>{member.email}</td>
                            <td>
                              <span className="role-badge">
                                {roleLabels[member.role]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
