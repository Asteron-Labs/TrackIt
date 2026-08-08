# TrackIt — Domain Model

This document defines the vocabulary and rules of the TrackIt domain. Read it before writing
code. Every name here is used exactly as written, in the database, the API and the interface.

## A note on method

This project borrows Domain-Driven Design's **ubiquitous language** and **bounded context**
thinking for its documentation and module boundaries. It does **not** implement tactical DDD —
there are no aggregate roots enforcing consistency in code, no value objects, no domain events,
no repositories-per-aggregate.

The implementation is a plainly layered modular monolith: controller → service → repository →
entity. Where this document says "aggregate", read it as *a cluster of entities that changes
together and shares invariants* — a modelling aid, not a class hierarchy.

This is deliberate. The domain is small enough that full tactical DDD would add ceremony
without adding clarity.

---

## Ubiquitous language

Use these words. Do not introduce synonyms.

| Term | Meaning |
| --- | --- |
| **Company** | The whole organisation. Implicit — there is one, and it is not an entity. |
| **Team** | A named group of employees with one lead and a weekly capacity. |
| **Team Lead** | The single employee responsible for a team's goals and assignments. |
| **Employee** | A person who is assigned tasks and records time. |
| **Super Admin** | The person who creates the company structure and sees everything. |
| **Goal** | A body of work owned by one team, with a start date and a deadline. |
| **Task** | An assignable unit of work under a goal, with an effort estimate. |
| **Assignee** | The single employee responsible for a task. |
| **Dependency** | A declaration that one task cannot proceed until another is done. |
| **Blocked** | A task with an unfinished prerequisite, or one a human marked blocked. |
| **Timesheet Entry** | Hours recorded by one employee against one task on one date. |
| **Estimated hours** | Effort forecast when a task is created. |
| **Recorded hours** | Effort actually logged against a task. |
| **Capacity** | A team's weekly available hours per person. Default 40. |
| **Utilisation** | Assigned estimated hours as a percentage of capacity. |
| **Workload** | The classification of utilisation: Available, Balanced, Overloaded. |
| **Priority score** | A calculated ranking value. Distinct from `priority`. |
| **Priority** | The manually set business priority: Low, Medium, High. |
| **Risk** | A detected condition threatening delivery. |

**Words we do not use:** *project* (say goal), *ticket* or *issue* (say task), *sprint*,
*story points*, *epic*, *manager* (say team lead or super admin), *resource* when referring to
a person (say employee).

---

## Contexts

Eight modules, grouped into four areas of responsibility.

### Identity & Organisation — `auth`, `users`, `teams`

Owns who exists and how they are grouped. Everything else depends on this and it depends
on nothing.

**Invariants**
- An email identifies exactly one user
- A team name is unique
- A team has exactly one lead, or none while being set up
- An employee belongs to at most one team, or none while being set up
- A team lead must be a member of the team they lead
- The current lead cannot be removed from the team until a replacement is assigned

### Work — `goals`, `tasks`

Owns what needs doing and who is doing it.

**Invariants**
- A goal belongs to exactly one team
- A goal's deadline falls after its start date
- A task belongs to exactly one goal
- A task's assignee is a member of the team owning the task's goal
- Estimated hours are greater than zero
- A task may be unassigned; time cannot then be logged against it
- A task cannot depend on itself
- Dependencies form no cycle
- Both ends of a dependency belong to the same team

### Effort — `timesheets`

Owns how much time was actually spent.

**Invariants**
- An entry belongs to one employee, one task and one date
- The employee is the task's assignee
- Hours are greater than zero
- One employee's total for one date does not exceed the daily maximum
- Repeated logs for the same employee, task and date add to one entry and append the work note
- The work date is not in the future
- Only the owning employee may edit or delete an entry

### Insight — `dashboards`, `audit`

Owns everything derived: workload, progress, risk, history, notifications. Reads from the
other three contexts and writes nothing back to them.

---

## Aggregates

Clusters that change together and share invariants.

### Team aggregate
```
Team (root)
 ├── TeamMember (many)
 └── team lead reference
```
Membership changes and lead assignment happen through the team. A `TeamMember` has no
meaning apart from its team.

### Goal aggregate
```
Goal (root)
 └── Task (many)
      ├── TaskDependency (many)
      └── assignee reference
```
A task cannot exist without a goal. Goal progress is a function of its tasks, which is why
they belong to the same cluster.

Dependencies live inside this cluster but may cross goals within a team.

### TimesheetEntry
Stands alone. It references a task and an employee but neither owns it. Deleting a task's
entries is a separate deliberate act, not a cascade.

### ActivityLog, Notification
Stand alone. Append-only, written by services, never modified.

---

## Domain rules

The rules below are the actual behaviour of the system. Each has one implementation.

### Goal progress
```
progress = tasks with status DONE / total tasks × 100
```
A goal with no tasks reports "no tasks yet", not 0%. Computed on read.

Counted, not weighted by hours. A goal with one 40-hour task and nine 1-hour tasks is not
90% done when the small ones finish — this is a known limitation, accepted for simplicity.

### Utilisation and workload
```
utilisation = estimated hours on active tasks / weekly capacity × 100

  ≤60%   Available
  ≤90%   Balanced
  >90%   Overloaded
```

**Active** means not `DONE`. Blocked tasks count — blocked work still occupies a person.

Utilisation is driven by **estimated** hours, not recorded hours. Recorded hours are the past;
assigned estimates are the commitment.

### Blocked
A task is blocked when at least one task it depends on is not `DONE`.

Only **direct** prerequisites count. If A waits on B and B waits on C, A is blocked by B.
B reports its own reason; the chain is visible by following it.

Dependency direction, stated once: a `TaskDependency` row means
**`taskId` is blocked by `dependsOnTaskId`**.

### Priority score
```
score = business priority
      + deadline urgency
      + dependency impact
      + goal importance
      − blocked penalty
```

```
High    +30     Due within 2 days   +30     Blocks another task  +10 each
Medium  +20     Due within 7 days   +20     Currently blocked    −40
Low     +10     Due later            +5
```

No due date counts as "due later". Overdue scores at least as high as due-within-2-days.

Every score carries its component breakdown, because recommendations must explain themselves
and a total alone cannot be decomposed after the fact.

### Effort variance
```
variance = recorded hours − estimated hours
```
Guard the division when estimated hours are zero, even though creation rejects that.

### Risk conditions

| Condition | Rule |
| --- | --- |
| Task overdue | past due date, not `DONE` |
| High-priority task blocked | blocked and priority `HIGH` |
| Goal deadline approaching | within 3 days, not complete |
| Goal progress below expectation | progress % lags elapsed % by more than 20 points |
| Unassigned task | no assignee, parent goal `ACTIVE` |
| Employee overloaded | utilisation above 90% |
| Actual exceeds estimate | recorded above 120% of estimate |
| No recent progress | no status change or time logged in 5 days |

All computed on read. Each detector calls the shared calculation above rather than
restating the rule.

---

## Lifecycle

```
Goal:  PLANNED → ACTIVE → COMPLETED
                        ↘ CANCELLED

Task:  TODO → IN_PROGRESS → DONE
          ↘ BLOCKED ↗
```

Goal status is set by a human, never derived. Deriving `COMPLETED` from task counts would
conflict with `CANCELLED` being a deliberate decision, and progress percentage already
communicates completion.

Task `BLOCKED` is human-set and coexists with computed blocked state. They are different
things: "waiting on TASK-104" and "blocked because the vendor hasn't replied" are both real.

---

## Access model

| | Super Admin | Team Lead | Employee |
| --- | --- | --- | --- |
| Teams & users | create, all | read own | read own |
| Goals & tasks | all | own team | assigned only |
| Assign tasks | all | own team | no |
| Task status | all | own team | own tasks |
| Log time | — | — | own tasks |
| Timesheets | all | own team | own only |
| Dashboards | company-wide | own team | no |

**Scope is enforced in the query.** An employee's task list is filtered in the repository, not
in React. This is a data-access rule, not a display rule.

---

## Resolved decisions

1. **A task has at most one assignee.** Assignment uses the nullable `Task.assigneeId` column.
   This keeps employee task ownership and per-person allocation unambiguous.
