# Dashboards module

The dashboards module owns read-only insight derived from teams, goals, tasks, and timesheets.
It does not persist workload, utilisation, progress, or risk values.

## Invariants

- An employee's utilisation is active-task estimated hours divided by the team's weekly capacity.
- Active tasks are every task not in `DONE`; manually blocked tasks still occupy capacity.
- Workload is `AVAILABLE` at or below 60%, `BALANCED` above 60% through 90%, and `OVERLOADED`
  above 90%.
- Recorded hours describe past effort and never change utilisation or workload classification.
- The requested date range filters recorded hours only. Capacity remains one weekly baseline even
  when the range is longer than one week.
- Employees without tasks or timesheet entries remain in allocation results with zero values.
- Team workload is loaded in one query regardless of the number of team members.
- Completed tasks are tasks in `DONE`. Overdue tasks have a due date before today and are not
  `DONE`.

## Public service methods

- `AllocationService.getEmployeeWorkloads(teamId, from, to)` returns each team member's task and
  effort totals, utilisation, and shared workload classification.
- `classifyWorkload(estimatedHours, capacityHours)` is the pure workload calculation reused by
  dashboards and risk checks.

## Repository methods

- `AllocationRepository.getEmployeeWorkloadData(teamId, from, to)` returns per-employee task and
  effort aggregates in one query, with an inclusive date range for recorded hours.
