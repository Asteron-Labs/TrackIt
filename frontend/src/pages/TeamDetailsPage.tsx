import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Navigation } from "../components/Navigation";
import { roleLabels } from "../components/role-navigation";
import { TeamLeadSelector } from "../components/TeamLeadSelector";
import { TeamMemberAssignmentForm } from "../components/TeamMemberAssignmentForm";
import type { TeamDetails, TeamDetailsResponse } from "../types/team";

export function TeamDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [removingUserId, setRemovingUserId] = useState("");
  const [error, setError] = useState("");
  const [membershipError, setMembershipError] = useState("");

  useEffect(() => {
    let requestWasCancelled = false;

    setIsLoading(true);
    setError("");
    apiRequest<TeamDetailsResponse>(`/teams/${id}`)
      .then((response) => {
        if (!requestWasCancelled) setTeam(response.team);
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load team details",
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) setIsLoading(false);
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [id, refreshVersion]);

  function refreshTeam(): void {
    setMembershipError("");
    setRefreshVersion((version) => version + 1);
  }

  async function removeMember(userId: string): Promise<void> {
    setMembershipError("");
    setRemovingUserId(userId);
    try {
      await apiRequest<void>(`/teams/${id}/members/${userId}`, {
        method: "DELETE",
      });
      refreshTeam();
    } catch (requestError) {
      setMembershipError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove the team member",
      );
    } finally {
      setRemovingUserId("");
    }
  }

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

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
                <p>{team.description || "No description provided."}</p>
              </div>
              <div className="team-heading-actions">
                <div className="capacity-summary">
                  <strong>{team.weeklyCapacityHours}</strong>
                  <span>hours weekly capacity</span>
                </div>
                <Link
                  className="secondary-link"
                  to={`/goals?teamId=${team.id}`}
                >
                  View team goals
                </Link>
                {user?.role === "TEAM_LEAD" && (
                  <Link
                    className="secondary-link"
                    to={`/teams/${team.id}/timesheets`}
                  >
                    View team timesheets
                  </Link>
                )}
              </div>
            </header>

            <div className="team-details-grid">
              {isSuperAdmin ? (
                <>
                  <TeamLeadSelector
                    teamId={team.id}
                    members={team.members}
                    currentLead={team.lead}
                    onLeadAssigned={refreshTeam}
                  />
                  <TeamMemberAssignmentForm
                    teamId={team.id}
                    refreshVersion={refreshVersion}
                    onMemberAdded={refreshTeam}
                  />
                </>
              ) : (
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
              )}

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
                    {team.memberCount}{" "}
                    {team.memberCount === 1 ? "member" : "members"}
                  </span>
                </div>

                {membershipError && (
                  <p className="form-error membership-error" role="alert">
                    {membershipError}
                  </p>
                )}

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
                          {isSuperAdmin && <th scope="col">Action</th>}
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
                            {isSuperAdmin && (
                              <td>
                                <button
                                  className="danger-button"
                                  type="button"
                                  disabled={Boolean(removingUserId)}
                                  onClick={() => removeMember(member.id)}
                                >
                                  {removingUserId === member.id
                                    ? "Removing…"
                                    : "Remove"}
                                </button>
                              </td>
                            )}
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
