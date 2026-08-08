# AGENTS.md

Standing rules for AI agents working in this repository. Read this before writing any code.

---

## What this project is

TrackIt is a company-wide task and resource tracking system. Teams have goals, goals have
tasks, tasks are assigned to employees, and employees log time against them. Managers see
progress, workload and delivery risk.

Read `docs/DOMAIN.md` before your first task. It defines the vocabulary used everywhere
in this codebase.

**This is a deliberately scoped project.** Prefer the simple, human readble code, do not make implementation too abstract and complicated, obvious implementation.
Do not add abstraction, configuration, or infrastructure that no current story requires.

---

## Code style — read before writing any code

All application code follows the **mid-level-engineer** style guide:
`.claude/skills/mid-level-engineer/SKILL.md`. Read it before implementing, refactoring, or
reviewing code. It is the single source of truth for how code should read here — clean,
flat, minimal abstraction, medium complexity. Claude Code loads it automatically; other
agents must open the file directly.

---

## Stack

```
Frontend:       React + TypeScript
Backend:        Node.js + Express + TypeScript
Database:       PostgreSQL
ORM:            TypeORM          (not Prisma — this was a deliberate decision)
Auth:           JWT
Validation:     Zod
API:            REST
Dev:            Docker Compose
```

Do not introduce another library when one of the above already solves the problem.
If you believe a new dependency is genuinely needed, say so and wait — do not install it.

---

## Architecture rules

Modular monolith. Every module has exactly four layers:

```
src/modules/<module>/
├── <module>.controller.ts   HTTP: routing, request/response, Zod validation
├── <module>.service.ts      business logic, authorisation, orchestration
├── <module>.repository.ts   data access, TypeORM queries
└── <module>.entity.ts       TypeORM entity definitions
```

Modules: `auth`, `users`, `teams`, `goals`, `tasks`, `timesheets`, `dashboards`, `audit`

**Hard rules:**

1. Controllers never import repositories. Ever.
2. Business rules live in services. A controller containing `if (user.role === ...)` is a bug.
3. Cross-module reads go through the other module's **service**, never its repository.
4. Validation happens at the controller boundary (Zod). Authorisation happens in the service.
5. Entities are TypeORM classes only. No business logic on entities.

---

## Authorisation

Two places, never anywhere else:

- **Role at the route** — `requireAuth`, then `requireRole('SUPER_ADMIN')` etc.
- **Scope in the service** — `assertTeamLeadOf`, `assertMemberOf`, `assertOwnsResource`

Error contract:

| Situation                                    | Status |
| -------------------------------------------- | ------ |
| No token / expired / malformed               | 401    |
| Valid token, wrong role                      | 403    |
| Valid token, resource outside caller's scope | 403    |

**Scope filtering happens in the query, not after it.** An endpoint that fetches a team's
tasks and filters to the caller's own in JavaScript is a security bug, even if the response
looks correct.

---

## Shared calculations — never duplicate these

Three calculations are consumed by several features. Each lives in one place as a pure
function with no repository access. **Import them. Do not re-implement them.**

| Function                                          | Lives in                           | Used by                                         |
| ------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| `classifyWorkload(estimatedHours, capacityHours)` | `dashboards/allocation.service.ts` | team dashboard, company overview, overload risk |
| `computeBlockedStates(taskIds)`                   | `tasks/dependency.service.ts`      | task views, priority scoring, blocked risk      |
| `calculateScore(task, context)`                   | `tasks/priority.service.ts`        | recommendations, sorting                        |

Two definitions must also be written once and reused:

- **overdue** — `dueDate < now && status !== 'DONE'`
- **effort variance** — recorded hours vs `estimatedHours`

If the dashboard and the risk panel ever disagree, it is because one of these was re-typed.

---

## Derived values are computed, not stored

Goal progress, utilisation, blocked state, priority scores and risks are calculated on read.
Do not add columns for them. Do not add background jobs to keep them fresh.

`Task.priorityScore` exists as a nullable column but stays null unless explicitly asked for.

---

## Query rules

- Listing N goals must not fire N count queries. One grouped query, keyed by goal id.
- Team workload runs in constant query count regardless of member count.
- Allocation tables **left join** from team members. An inner join drops employees with zero
  tasks — precisely the rows a resource dashboard exists to show.

---

## Commits

**The human commits, not the agent.** Never run `git commit`, `git push`, `git checkout`,
or any other state-changing git command. Stage nothing. When work is done, stop and say so.

Target is roughly **two commits per story**, split backend then frontend. Write the code so
that split is clean — finish and verify the backend before starting the UI.

Commit message format, for reference when asked to draft one:

```
<type>(<module>): TRACKIT-XX <what changed>

feat(tasks): TRACKIT-20 add task creation under goals
feat(tasks): TRACKIT-20 add task form and list to goal details
fix(timesheets): TRACKIT-24 reject future-dated entries
```

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`

---

## Working style

**Plan first.** For any story, produce a plan before writing code. The plan should name the
files you will create or change, layer by layer. Wait for approval.

**Stay inside the story.** Implement what the Jira ticket describes and nothing else.
If you spot something else that needs doing, mention it — do not fix it.

**Ask when the ticket is ambiguous.** Several stories carry open decisions marked in their
descriptions. If you hit one that has not been settled, stop and ask rather than picking.

**No speculative work.** No feature flags, no caching layers, no abstract base classes for
a single implementation, no "we might need this later" parameters.

**Tests.** Unit tests are required for the three shared calculations and for any function
with branching business rules. Everything else is judgement — do not write tests that only
restate the implementation.

---

## Things that are out of scope — do not build them

- Email, Slack or push notifications (in-app only)
- Password reset, email verification, SSO, multi-tenancy
- Timesheet approval workflows
- Billing, invoicing, payroll, cost rates
- ML or predictive scoring — all rules are deterministic constants
- Automatic task assignment or scheduling
- Critical-path analysis, Gantt charts
- Dark mode, drag-and-drop boards, CSV export (unless a story asks)

---

## Configuration

Tunable values live in `src/common/config`, never as inline literals:

```
MAX_DAILY_HOURS              12
DEFAULT_WEEKLY_CAPACITY      40
WORKLOAD_AVAILABLE_MAX       60      // ≤60% available
WORKLOAD_BALANCED_MAX        90      // ≤90% balanced, above = overloaded
EFFORT_OVERRUN_THRESHOLD     120     // % of estimate before a risk is raised
DEADLINE_APPROACHING_DAYS    3
NO_PROGRESS_DAYS             5
JWT_EXPIRY                   24h

PRIORITY_HIGH                30
PRIORITY_MEDIUM              20
PRIORITY_LOW                 10
DUE_WITHIN_2_DAYS            30
DUE_WITHIN_7_DAYS            20
DUE_LATER                     5
BLOCKS_ANOTHER_TASK          10      // per dependent task
BLOCKED_PENALTY             -40
GOAL_IMPORTANCE_HIGH         20
GOAL_IMPORTANCE_MEDIUM       10
GOAL_IMPORTANCE_LOW           5
```

---

## Documentation

Each module carries a short `README.md` covering its purpose, its invariants, and its public
service methods. Update it in the same change as the code, not afterwards.

Keep `docs/DOMAIN.md` accurate. If a story changes a domain rule, that file changes too.
