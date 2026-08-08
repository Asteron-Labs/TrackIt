import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { CompanyEmployeeAllocationTable } from '../components/CompanyEmployeeAllocationTable';
import { CompanyTeamComparisonTable } from '../components/CompanyTeamComparisonTable';
import { Navigation } from '../components/Navigation';
import type { CompanySummaryResponse } from '../types/dashboard';
import type { Team, TeamsResponse } from '../types/team';

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

function summaryPath(from: string, to: string, teamId: string): string {
  const query = new URLSearchParams({ from, to });
  if (teamId) query.set('teamId', teamId);
  return `/company/summary?${query.toString()}`;
}

function CompanyDashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading company dashboard" aria-busy="true">
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

export function CompanyDashboardPage() {
  const initialRange = currentWeekRange();
  const [teams, setTeams] = useState<Team[]>([]);
  const [summary, setSummary] = useState<CompanySummaryResponse | null>(null);
  const [teamId, setTeamId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let requestWasCancelled = false;

    async function loadDashboard(): Promise<void> {
      try {
        const [teamsResponse, summaryResponse] = await Promise.all([
          apiRequest<TeamsResponse>('/teams'),
          apiRequest<CompanySummaryResponse>(summaryPath(initialRange.from, initialRange.to, '')),
        ]);
        if (!requestWasCancelled) {
          setTeams(teamsResponse.teams);
          setSummary(summaryResponse);
        }
      } catch (requestError) {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load the company dashboard',
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
  }, [initialRange.from, initialRange.to]);

  async function filterDashboard(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsFiltering(true);
    setError('');

    try {
      const response = await apiRequest<CompanySummaryResponse>(summaryPath(from, to, teamId));
      setSummary(response);
      if (employeeId && !response.employees.some((employee) => employee.employeeId === employeeId)) {
        setEmployeeId('');
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to filter the company dashboard',
      );
    } finally {
      setIsFiltering(false);
    }
  }

  const employeeOptions = summary?.employees ?? [];
  const visibleEmployees = employeeId
    ? employeeOptions.filter((employee) => employee.employeeId === employeeId)
    : employeeOptions;
  const kpiCards = summary
    ? [
        { label: 'Total teams', value: summary.kpis.totalTeams },
        { label: 'Total employees', value: summary.kpis.totalEmployees },
        { label: 'Active goals', value: summary.kpis.activeGoals },
        { label: 'Total tasks', value: summary.kpis.totalTasks },
        { label: 'Overdue', value: summary.kpis.overdueTasks },
      ]
    : [];

  return (
    <div className="app-shell">
      <Navigation />
      <main className="dashboard-page company-dashboard-page">
        {isLoading && <CompanyDashboardSkeleton />}
        {!isLoading && error && !summary && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!isLoading && summary && (
          <>
            <header className="page-heading dashboard-heading">
              <div>
                <p className="eyebrow">Company dashboard</p>
                <h1>Allocation overview</h1>
                <p>Compare team health and find employees who need work rebalanced.</p>
              </div>
            </header>

            <form className="company-dashboard-filter" onSubmit={filterDashboard}>
              <label>
                Team
                <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                  <option value="">All teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Employee
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                >
                  <option value="">All employees</option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.employeeName} — {employee.teamName}
                    </option>
                  ))}
                </select>
              </label>
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
                {isFiltering ? 'Filtering…' : 'Apply filters'}
              </button>
            </form>

            {error && (
              <p className="form-error dashboard-error" role="alert">
                {error}
              </p>
            )}

            <section className="dashboard-kpis" aria-label="Company key performance indicators">
              {kpiCards.map((kpi) => (
                <div className="dashboard-kpi-card" key={kpi.label}>
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                </div>
              ))}
            </section>

            <section className="panel company-dashboard-panel" aria-labelledby="team-health-title">
              <div className="panel-heading">
                <p className="eyebrow">Team health</p>
                <h2 id="team-health-title">Team comparison</h2>
                <p>Overloaded counts sit beside averages so individual pressure stays visible.</p>
              </div>
              {isFiltering ? (
                <p className="list-message">Updating team allocation…</p>
              ) : (
                <CompanyTeamComparisonTable teams={summary.teams} />
              )}
            </section>

            <section
              className="panel company-dashboard-panel"
              aria-labelledby="company-allocation-title"
            >
              <div className="panel-heading">
                <p className="eyebrow">Employee workload</p>
                <h2 id="company-allocation-title">Company allocation</h2>
                <p>
                  Recorded hours cover {summary.range.from} to {summary.range.to}; active estimates
                  use weekly capacity. Employee selection filters this table only.
                </p>
              </div>
              {isFiltering ? (
                <p className="list-message">Updating employee allocation…</p>
              ) : (
                <CompanyEmployeeAllocationTable employees={visibleEmployees} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
