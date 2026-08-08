import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Navigation } from '../components/Navigation';
import { TeamCreationForm } from '../components/TeamCreationForm';
import type { Team, TeamsResponse } from '../types/team';

export function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoading(true);
    setError('');
    apiRequest<TeamsResponse>('/teams')
      .then((response) => {
        if (!requestWasCancelled) setTeams(response.teams);
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load teams',
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) setIsLoading(false);
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [refreshVersion]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const emptyMessage = isSuperAdmin
    ? 'No teams have been created yet.'
    : 'You are not currently assigned as a team lead.';

  return (
    <div className="app-shell">
      <Navigation />
      <main className="teams-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Company structure</p>
            <h1>{isSuperAdmin ? 'Teams' : 'My team'}</h1>
            <p>View team capacity, leadership, and membership.</p>
          </div>
        </header>

        <div className={isSuperAdmin ? 'teams-layout' : undefined}>
          {isSuperAdmin && (
            <TeamCreationForm
              onCreated={() => setRefreshVersion((version) => version + 1)}
            />
          )}

          <section
            className="panel teams-list-panel"
            aria-labelledby="teams-list-title"
          >
            <div className="list-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2 id="teams-list-title">Team list</h2>
              </div>
            </div>

            {isLoading && <p className="list-message">Loading teams…</p>}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {!isLoading && !error && teams.length === 0 && (
              <p className="list-message">{emptyMessage}</p>
            )}
            {!isLoading && !error && teams.length > 0 && (
              <div className="table-wrapper">
                <table className="teams-table">
                  <thead>
                    <tr>
                      <th scope="col">Team</th>
                      <th scope="col">Description</th>
                      <th scope="col">Weekly capacity</th>
                      <th scope="col">Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr key={team.id}>
                        <td>
                          <Link className="team-link" to={`/teams/${team.id}`}>
                            {team.name}
                          </Link>
                        </td>
                        <td>{team.description || 'No description'}</td>
                        <td>{team.weeklyCapacityHours} hours</td>
                        <td>{team.leadId ? 'Assigned' : 'Not assigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
