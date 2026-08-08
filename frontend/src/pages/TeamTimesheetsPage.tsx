import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Navigation } from '../components/Navigation';
import { TeamTimesheetTable } from '../components/TeamTimesheetTable';
import type { TeamDetails, TeamDetailsResponse } from '../types/team';
import type { TeamTimesheetsResponse } from '../types/timesheet';

export function TeamTimesheetsPage() {
  const { id } = useParams();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [timesheets, setTimesheets] = useState<TeamTimesheetsResponse | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let requestWasCancelled = false;

    async function loadInitialTimesheets(): Promise<void> {
      setIsLoading(true);
      setError('');

      try {
        const [teamResponse, timesheetResponse] = await Promise.all([
          apiRequest<TeamDetailsResponse>(`/teams/${id}`),
          apiRequest<TeamTimesheetsResponse>(`/teams/${id}/timesheets`),
        ]);

        if (!requestWasCancelled) {
          setTeam(teamResponse.team);
          setTimesheets(timesheetResponse);
          setFrom(timesheetResponse.range.from);
          setTo(timesheetResponse.range.to);
        }
      } catch (requestError) {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load team timesheets',
          );
        }
      } finally {
        if (!requestWasCancelled) setIsLoading(false);
      }
    }

    void loadInitialTimesheets();

    return () => {
      requestWasCancelled = true;
    };
  }, [id]);

  async function filterTimesheets(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsFiltering(true);
    setError('');

    try {
      const response = await apiRequest<TeamTimesheetsResponse>(
        `/teams/${id}/timesheets?from=${from}&to=${to}`,
      );
      setTimesheets(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to filter team timesheets',
      );
    } finally {
      setIsFiltering(false);
    }
  }

  return (
    <div className="app-shell">
      <Navigation />
      <main className="team-timesheets-page">
        <Link className="back-link" to={`/teams/${id}`}>
          ← Back to team
        </Link>

        {isLoading && <p className="list-message">Loading team timesheets…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!isLoading && team && timesheets && (
          <>
            <header className="page-heading team-timesheets-heading">
              <div>
                <p className="eyebrow">Team timesheets</p>
                <h1>{team.name}</h1>
                <p>Review time recorded by each team member.</p>
              </div>
            </header>

            <section className="panel team-timesheets-panel" aria-labelledby="entries-title">
              <div className="team-timesheet-toolbar">
                <div>
                  <p className="eyebrow">Recorded time</p>
                  <h2 id="entries-title">Entries by member</h2>
                </div>
                <form className="team-timesheet-filter" onSubmit={filterTimesheets}>
                  <label>
                    From
                    <input
                      type="date"
                      value={from}
                      required
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={to}
                      required
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </label>
                  <button className="submit-button" type="submit" disabled={isFiltering}>
                    {isFiltering ? 'Filtering…' : 'Apply filter'}
                  </button>
                </form>
              </div>

              {isFiltering ? (
                <p className="list-message">Filtering entries…</p>
              ) : (
                <TeamTimesheetTable entries={timesheets.entries} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
