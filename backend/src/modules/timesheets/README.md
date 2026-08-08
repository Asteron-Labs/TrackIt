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
- Only the employee who owns an entry may edit its hours or work note or delete it. Team Leads
  observe employee entries but cannot rewrite them.
- Editing hours re-validates both the replacement value and the adjusted daily total.
- `submissionStatus` remains `SUBMITTED`; no approval workflow exists.
- Employee history is always bounded to an inclusive date range of at most
  `MAX_TIMESHEET_HISTORY_RANGE_DAYS`. An omitted range means the current Monday-to-Sunday week.
- History entries and their daily and per-task totals are scoped to the employee in SQL.

## Public service methods

- `TimesheetService.logTime(dto, caller)` validates ownership and daily limits, then creates or
  adds to the employee's entry and returns the new daily total.
- `TimesheetService.updateEntry(entryId, dto, caller)` checks ownership, re-validates the entry,
  and updates its hours and/or work note.
- `TimesheetService.deleteEntry(entryId, caller)` checks ownership and deletes the entry.
- `TimesheetService.getMyHistory(callerId, range)` resolves and validates the bounded range, then
  returns joined entries plus daily and per-task totals.

## Repository methods

- `create`, `update`, and `delete` persist time entries.
- `findById` supports ownership checks for edits and deletions.
- `findByEmployeeAndDate` and `findByEmployeeAndTaskAndDate` support daily validation and upsert.
- `findByTask`, `sumHoursByTask`, and `sumHoursByEmployeeInRange` provide the reads required by
  later effort and timesheet views.
- `findByEmployeeInRange` returns an employee's entries with task and goal details.
- `sumHoursByEmployeeGroupedByDate` and `sumHoursByEmployeeGroupedByTask` calculate reusable
  server-side history rollups.
