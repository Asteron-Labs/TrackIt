import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { EmployeeWorkloadTable } from '../components/EmployeeWorkloadTable';
import { GoalProgress } from '../components/GoalProgress';
import { Navigation } from '../components/Navigation';
import type { TeamSummaryResponse } from '../types/dashboard';
import type { Team, TeamDetailsResponse, TeamsResponse } from '../types/team';

function currentWeekRange(): { from: string; to: string } {
  const today = new Date();
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - daysSinceMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

function summaryPath(teamId: string, from: string, to: string): string {
  const query = new URLSearchParams({ from, to });
  return `/teams/${teamId}/summary?${query.toString()}`;
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading team dashboard" aria-busy="true">
      <div className="skeleton-line skeleton-heading" />
      <div className="dashboard-kpis">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="skeleton-card" key={index} />
        ))}
      </div>
      <div className="skeleton-panel" />
      <div className="skeleton-panel" />
    </div>
  );
}

export function TeamDashboardPage() {
  const { id: routeTeamId } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [summary, setSummary] = useState<TeamSummaryResponse | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let requestWasCancelled = false;

    async function loadDashboard(): Promise<void> {
      const initialRange = currentWeekRange();
      setFrom(initialRange.from);
      setTo(initialRange.to);
      setError('');

      try {
        let dashboardTeam: Team | undefined;
        if (routeTeamId) {
          const teamResponse = await apiRequest<TeamDetailsResponse>(`/teams/${routeTeamId}`);
          dashboardTeam = teamResponse.team;
        } else {
          const teamsResponse = await apiRequest<TeamsResponse>('/teams');
          dashboardTeam = teamsResponse.teams[0];
        }
        if (!dashboardTeam) return;

        const summaryResponse = await apiRequest<TeamSummaryResponse>(
          summaryPath(dashboardTeam.id, initialRange.from, initialRange.to),
        );
        if (!requestWasCancelled) {
          setTeam(dashboardTeam);
          setSummary(summaryResponse);
        }
      } catch (requestError) {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load the team dashboard',
          );
        }
      } finally {
        if (!requestWasCancelled) setIsLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      requestWasCancelled = true;
    };
  }, [routeTeamId]);

  async function filterDashboard(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!team) return;

    setIsFiltering(true);
    setError('');
    try {
      const response = await apiRequest<TeamSummaryResponse>(summaryPath(team.id, from, to));
      setSummary(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to filter the team dashboard',
      );
    } finally {
      setIsFiltering(false);
    }
  }

  const kpiCards = summary
    ? [
        { label: 'Active goals', value: summary.kpis.activeGoals },
        { label: 'Total tasks', value: summary.kpis.totalTasks },
        { label: 'Completed', value: summary.kpis.completedTasks },
        { label: 'Blocked', value: summary.kpis.blockedTasks },
        { label: 'Overdue', value: summary.kpis.overdueTasks },
      ]
    : [];

  return (
    <div className="app-shell">
      <Navigation />
      <main className="dashboard-page">
        {isLoading && <DashboardSkeleton />}
        {!isLoading && error && !summary && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!isLoading && !error && !team && (
          <section className="panel dashboard-unassigned-state">
            <p className="eyebrow">Team dashboard</p>
            <h1>No team assigned</h1>
            <p>You are not currently assigned as a team lead.</p>
          </section>
        )}

        {!isLoading && team && summary && (
          <>
            {routeTeamId && (
              <Link className="back-link" to="/">
                ← Back to company overview
              </Link>
            )}
            <header className="page-heading dashboard-heading">
              <div>
                <p className="eyebrow">Team dashboard</p>
                <h1>{team.name}</h1>
                <p>See current delivery progress and how work is allocated across the team.</p>
              </div>
              <form className="dashboard-filter" onSubmit={filterDashboard}>
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
            </header>

            {error && (
              <p className="form-error dashboard-error" role="alert">
                {error}
              </p>
            )}

            <section className="dashboard-kpis" aria-label="Team key performance indicators">
              {kpiCards.map((kpi) => (
                <div className="dashboard-kpi-card" key={kpi.label}>
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                </div>
              ))}
            </section>

            <section className="panel dashboard-workload-panel" aria-labelledby="workload-title">
              <div className="panel-heading">
                <p className="eyebrow">Employee workload</p>
                <h2 id="workload-title">Allocation</h2>
                <p>
                  Recorded hours cover {summary.range.from} to {summary.range.to}; active estimates
                  use weekly capacity.
                </p>
              </div>
              {isFiltering ? (
                <p className="list-message">Updating recorded hours…</p>
              ) : (
                <EmployeeWorkloadTable employees={summary.employees} />
              )}
            </section>

            <section className="panel dashboard-goals-panel" aria-labelledby="active-goals-title">
              <div className="panel-heading">
                <p className="eyebrow">Delivery progress</p>
                <h2 id="active-goals-title">Active goals</h2>
                <p>Progress is based on completed tasks within each active goal.</p>
              </div>

              {summary.activeGoals.length === 0 ? (
                <p className="empty-state">This team has no active goals.</p>
              ) : (
                <div className="dashboard-goal-list">
                  {summary.activeGoals.map((goal) => (
                    <article className="dashboard-goal" key={goal.id}>
                      <div className="dashboard-goal-heading">
                        <div>
                          <Link className="goal-link" to={`/goals/${goal.id}`}>
                            {goal.title}
                          </Link>
                          <span>Due {goal.deadline}</span>
                        </div>
                      </div>
                      <GoalProgress
                        progress={goal.progress}
                        noTasksYet={goal.noTasksYet}
                        breakdown={goal.taskStatusBreakdown}
                        compact
                      />
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
