import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { GoalCreationForm } from "../components/GoalCreationForm";
import { GoalStatusBadge } from "../components/GoalStatusBadge";
import { Navigation } from "../components/Navigation";
import type { Goal, GoalsResponse } from "../types/goal";
import type { Team, TeamsResponse } from "../types/team";

export function TeamGoalsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTeamId = searchParams.get("teamId");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [goalError, setGoalError] = useState("");

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoadingTeams(true);
    setTeamError("");
    apiRequest<TeamsResponse>("/teams")
      .then((response) => {
        if (requestWasCancelled) return;
        setTeams(response.teams);

        const requestedTeamExists = response.teams.some(
          (team) => team.id === requestedTeamId,
        );
        const initialTeamId = requestedTeamExists
          ? requestedTeamId!
          : (response.teams[0]?.id ?? "");
        setSelectedTeamId(initialTeamId);
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setTeamError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load teams",
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) setIsLoadingTeams(false);
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [requestedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) {
      setGoals([]);
      return;
    }

    let requestWasCancelled = false;
    setIsLoadingGoals(true);
    setGoalError("");
    apiRequest<GoalsResponse>(`/teams/${selectedTeamId}/goals`)
      .then((response) => {
        if (!requestWasCancelled) setGoals(response.goals);
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setGoalError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load goals",
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) setIsLoadingGoals(false);
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [selectedTeamId, refreshVersion]);

  function selectTeam(teamId: string): void {
    setSelectedTeamId(teamId);
    setSearchParams({ teamId }, { replace: true });
  }

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const canManageGoals =
    user?.role === "SUPER_ADMIN" || user?.role === "TEAM_LEAD";
  const noTeamMessage =
    user?.role === "SUPER_ADMIN"
      ? "No teams have been created yet."
      : "You are not currently assigned to a team.";

  return (
    <div className="app-shell">
      <Navigation />
      <main className="goals-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Team direction</p>
            <h1>Team goals</h1>
            <p>Track the outcomes, dates, and current status for each team.</p>
          </div>
        </header>

        {isLoadingTeams && <p className="list-message">Loading teams…</p>}
        {teamError && (
          <p className="form-error" role="alert">
            {teamError}
          </p>
        )}
        {!isLoadingTeams && !teamError && teams.length === 0 && (
          <section className="panel">
            <p className="empty-state">{noTeamMessage}</p>
          </section>
        )}

        {!isLoadingTeams && !teamError && teams.length > 0 && (
          <>
            {user?.role === "SUPER_ADMIN" && (
              <div className="team-goal-selector">
                <label htmlFor="goal-team">Team</label>
                <select
                  id="goal-team"
                  value={selectedTeamId}
                  onChange={(event) => selectTeam(event.target.value)}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={canManageGoals ? "goals-layout" : undefined}>
              {canManageGoals && selectedTeamId && (
                <GoalCreationForm
                  key={selectedTeamId}
                  teamId={selectedTeamId}
                  onCreated={() => setRefreshVersion((version) => version + 1)}
                />
              )}

              <section
                className="panel goals-list-panel"
                aria-labelledby="goals-list-title"
              >
                <div className="list-heading">
                  <div>
                    <p className="eyebrow">Delivery plan</p>
                    <h2 id="goals-list-title">
                      {selectedTeam ? `${selectedTeam.name} goals` : "Goals"}
                    </h2>
                  </div>
                </div>

                {isLoadingGoals && (
                  <p className="list-message">Loading goals…</p>
                )}
                {goalError && (
                  <p className="form-error" role="alert">
                    {goalError}
                  </p>
                )}
                {!isLoadingGoals && !goalError && goals.length === 0 && (
                  <p className="empty-state">This team has no goals yet.</p>
                )}
                {!isLoadingGoals && !goalError && goals.length > 0 && (
                  <div className="table-wrapper">
                    <table className="goals-table">
                      <thead>
                        <tr>
                          <th scope="col">Goal</th>
                          <th scope="col">Deadline</th>
                          <th scope="col">Status</th>
                          <th scope="col">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {goals.map((goal) => (
                          <tr key={goal.id}>
                            <td>
                              <Link
                                className="goal-link"
                                to={`/goals/${goal.id}`}
                              >
                                {goal.title}
                              </Link>
                            </td>
                            <td>{goal.deadline}</td>
                            <td>
                              <GoalStatusBadge
                                status={goal.status}
                                deadline={goal.deadline}
                              />
                            </td>
                            <td>
                              {goal.progress === null
                                ? "No tasks yet"
                                : `${Math.round(goal.progress)}%`}
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
