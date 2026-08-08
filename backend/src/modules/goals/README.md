# Goals module

The goals module owns the body of work a team commits to, including its dates, importance, and
manually controlled lifecycle status.

## Invariants

- A goal belongs to exactly one team.
- A goal's deadline falls strictly after its start date.
- New goals start in `PLANNED` status.
- Goal status is set by a person and is never derived from task status.
- Importance is `LOW`, `MEDIUM`, or `HIGH`; priority scoring consumes it in a later story.
- Team Leads manage only their own team's goals, Super Admins manage any team's goals, and
  Employees have read-only access to their team's goals.
- Team scope is authorized through `ScopeService`, and returned goal queries include the
  authorized team id.
- Progress is the percentage of tasks in `DONE`, counted rather than weighted by estimated hours.
- Progress and status counts are derived on read and never stored.
- A goal with no tasks returns `0%` with `noTasksYet: true` so clients show an explanatory state.
- Goal lists load status counts for every returned goal in one grouped query.

## Public service methods

- `GoalService.createGoal(dto, caller)` creates a planned goal after checking team scope and dates.
- `GoalService.listTeamGoals(teamId, filter, caller)` lists visible team goals with an optional
  status filter.
- `GoalService.getGoal(goalId, caller)` returns a goal through a team-scoped query.
- `GoalService.updateGoal(goalId, dto, caller)` updates editable goal fields and rechecks dates.
- `GoalService.calculateProgress(goalId)` returns progress and the task-status breakdown from one
  grouped task count.
