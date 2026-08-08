# Tasks module

The tasks module owns assignable units of work under goals, including their estimates, dates,
manual priority, and lifecycle status.

## Invariants

- A task belongs to exactly one goal.
- Estimated hours are greater than zero.
- New tasks start in `TODO` status and may be unassigned.
- A task has at most one assignee, who belongs to the team that owns the parent goal.
- Team Leads manage only their own team's tasks, Super Admins manage any task, and Employees read
  only tasks assigned to them.
- Employees update status only on their own assigned tasks. Team Leads update status on tasks in
  their team, and Super Admins update status on any task.
- Task scope is applied in repository queries.
- `BLOCKED` is a manual lifecycle status and remains separate from dependency-derived blocking.
- A due date after the goal deadline is allowed and reported through `dueDatePastGoalDeadline`.
- `overdue` is derived on read when the due date is past and the task is not `DONE`.
- `businessImpact` and `priorityScore` stay null until recommendation work is implemented.
- Effort variance is recorded hours minus estimated hours and is calculated on read.
- Effort above 100% is over estimate; effort strictly above `EFFORT_OVERRUN_THRESHOLD` is an
  overrun. A zero estimate produces no variance percentage.

## Public service methods

- `TaskService.createTask(goalId, dto, caller)` creates an unassigned TODO task for an authorized
  goal.
- `TaskService.listGoalTasks(goalId, caller)` lists tasks visible to the caller under a goal.
- `TaskService.getMyTasks(callerId, filter)` lists only tasks assigned to the caller, with optional
  status and due-before filters applied by the repository query and the parent goal joined.
- `TaskService.getTask(taskId, caller)` returns one task through a caller-scoped query.
- `TaskService.getTaskEffort(taskId, caller)` returns estimated and actual hours, variance,
  classification, and the contributing timesheet entries after checking task scope.
- `TaskService.updateTask(taskId, dto, caller)` updates title, description, priority, estimate, or
  due date after checking team scope.
- `TaskService.assignTask(taskId, assigneeId, caller)` lets the owning Team Lead assign or
  reassign a task to one member of the goal's team, or pass `null` to return it to unassigned.
- `TaskService.updateStatus(taskId, status, caller)` changes lifecycle status after checking task
  ownership or team scope for the caller's role.
