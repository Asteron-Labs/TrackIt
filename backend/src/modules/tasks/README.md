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
- Task scope is applied in repository queries.
- A due date after the goal deadline is allowed and reported through `dueDatePastGoalDeadline`.
- `overdue` is derived on read when the due date is past and the task is not `DONE`.
- `businessImpact` and `priorityScore` stay null until recommendation work is implemented.

## Public service methods

- `TaskService.createTask(goalId, dto, caller)` creates an unassigned TODO task for an authorized
  goal.
- `TaskService.listGoalTasks(goalId, caller)` lists tasks visible to the caller under a goal.
- `TaskService.getTask(taskId, caller)` returns one task through a caller-scoped query.
- `TaskService.updateTask(taskId, dto, caller)` updates title, description, priority, estimate, or
  due date after checking team scope.
- `TaskService.assignTask(taskId, assigneeId, caller)` lets the owning Team Lead assign or
  reassign a task to one member of the goal's team, or pass `null` to return it to unassigned.
