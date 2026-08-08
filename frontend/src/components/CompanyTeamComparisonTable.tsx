import { Link } from 'react-router-dom';
import type { CompanyTeamSummary } from '../types/dashboard';

interface CompanyTeamComparisonTableProps {
  teams: CompanyTeamSummary[];
}

export function CompanyTeamComparisonTable({ teams }: CompanyTeamComparisonTableProps) {
  if (teams.length === 0) {
    return <p className="empty-state">No teams match the selected filters.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="company-team-table">
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Employees</th>
            <th scope="col">Active goals</th>
            <th scope="col">Tasks</th>
            <th scope="col">Average utilisation</th>
            <th scope="col">Overloaded</th>
            <th scope="col">Available</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.teamId}>
              <td>
                <Link className="team-link" to={`/teams/${team.teamId}/dashboard`}>
                  {team.teamName}
                </Link>
              </td>
              <td>{team.memberCount}</td>
              <td>{team.activeGoals}</td>
              <td>{team.totalTasks}</td>
              <td>{team.averageUtilisation.toFixed(1)}%</td>
              <td>
                <strong className={team.overloadedMemberCount > 0 ? 'overloaded-count' : undefined}>
                  {team.overloadedMemberCount}
                </strong>
              </td>
              <td>{team.availableMemberCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
