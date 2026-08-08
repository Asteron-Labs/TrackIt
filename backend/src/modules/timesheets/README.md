# Timesheets module

The timesheets module owns recorded effort: hours entered by an employee against one assigned
task on one date.

## Invariants

- Only an Employee assigned to a task may log time against it.
- Hours are positive and neither one log nor a day's running total may exceed
  `MAX_DAILY_HOURS`.
- Work dates are date-only values and cannot be in the future.
- One row represents an employee, task, and date. A later log adds to that row and appends its
  non-empty work note.
- `submissionStatus` remains `SUBMITTED`; no approval workflow exists.

## Public service methods

- `TimesheetService.logTime(dto, caller)` validates ownership and daily limits, then creates or
  adds to the employee's entry and returns the new daily total.

## Repository methods

- `create` and `update` persist time entries.
- `findByEmployeeAndDate` and `findByEmployeeAndTaskAndDate` support daily validation and upsert.
- `findByTask`, `sumHoursByTask`, and `sumHoursByEmployeeInRange` provide the reads required by
  later effort and timesheet views.
