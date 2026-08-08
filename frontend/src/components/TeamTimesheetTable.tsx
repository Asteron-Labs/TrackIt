import { Link } from 'react-router-dom';
import type { TeamTimesheetEntry } from '../types/timesheet';

interface TeamTimesheetTableProps {
  entries: TeamTimesheetEntry[];
}

interface MemberEntries {
  employee: TeamTimesheetEntry['employee'];
  entries: TeamTimesheetEntry[];
}

function groupEntriesByMember(entries: TeamTimesheetEntry[]): MemberEntries[] {
  const groups = new Map<string, MemberEntries>();

  for (const entry of entries) {
    const existingGroup = groups.get(entry.employee.id);
    if (existingGroup) {
      existingGroup.entries.push(entry);
    } else {
      groups.set(entry.employee.id, {
        employee: entry.employee,
        entries: [entry],
      });
    }
  }

  return [...groups.values()];
}

export function TeamTimesheetTable({ entries }: TeamTimesheetTableProps) {
  const memberGroups = groupEntriesByMember(entries);

  if (memberGroups.length === 0) {
    return <p className="empty-state">No time was recorded in this date range.</p>;
  }

  return (
    <div className="team-timesheet-groups">
      {memberGroups.map((group) => {
        const totalHours = group.entries.reduce((total, entry) => total + entry.hoursSpent, 0);

        return (
          <section className="team-timesheet-member" key={group.employee.id}>
            <div className="team-timesheet-member-heading">
              <h3>{group.employee.name}</h3>
              <span>{totalHours.toLocaleString()} hours</span>
            </div>
            <div className="table-wrapper">
              <table className="team-timesheets-table">
                <thead>
                  <tr>
                    <th scope="col">Work date</th>
                    <th scope="col">Task</th>
                    <th scope="col">Goal</th>
                    <th scope="col">Hours</th>
                    <th scope="col">Work note</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.workDate}</td>
                      <td>
                        <Link className="task-link" to={`/tasks/${entry.task.id}`}>
                          {entry.task.title}
                        </Link>
                      </td>
                      <td>{entry.goal.title}</td>
                      <td>{entry.hoursSpent}</td>
                      <td>{entry.workNote || 'No work note'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
