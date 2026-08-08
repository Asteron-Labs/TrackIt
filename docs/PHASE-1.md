# TrackIt — Phase 1 End-to-End

This document records **what Phase 1 delivered and how it works end to end** — from the React
UI, through the REST API and service layer, down to the PostgreSQL schema. It describes the
system as built, not the full product vision. For the complete domain model (all eight modules)
see [`DOMAIN.md`](DOMAIN.md); for engineering rules see [`../AGENTS.md`](../AGENTS.md).

---

## 1. Overview

Phase 1 builds the **Identity & Organisation** slice of TrackIt end to end: who exists, how they
authenticate, and how they are grouped into teams. It is the foundation every later context
depends on and depends on nothing itself.

**Tickets delivered**

| Ticket | What it added |
| --- | --- |
| TRACKIT-12 | Backend scaffold — Express + TypeORM + PostgreSQL, layered module structure, `/health` |
| TRACKIT-13 | JWT authentication backend + login UI, persistent auth, protected routes, seeded accounts |
| TRACKIT-14 | Role and scope authorization (`requireRole`, `ScopeService`, query-level data scoping) |
| TRACKIT-15 | Super Admin user management (create + list) |
| TRACKIT-16 | Team creation and scoped team details |
| TRACKIT-17 | Team membership and lead assignment |
| TRACKIT-18 | Seed of the demo company structure |
| TRACKIT-39 | Frontend sends API requests to the backend base URL (removed the Vite dev proxy) |

**Modules implemented:** `auth`, `users`, `teams` — plus the `health` infrastructure module.

**Not yet built (Phase 2 and beyond).** The remaining five modules from `DOMAIN.md` are specified
but have **no** entities, endpoints, or pages yet. On the frontend they appear only as
label-only sidebar items with no route:

- **Work** — `goals`, `tasks`
- **Effort** — `timesheets`
- **Insight** — `dashboards`, `audit`

The tunables in `backend/src/common/config/constants.ts` for workload, risk, and priority
scoring are placeholders for those future phases and are not consumed by any Phase 1 code.

---

## 2. Architecture at a glance

**Stack**

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + TypeORM (`synchronize: false`, migrations only) |
| Validation | Zod (at the controller boundary) |
| Auth | JWT (HS256, 24h) + bcrypt password hashing |
| Dev | Docker Compose |

**Four-layer convention.** Every backend module lives under `backend/src/modules/<module>/` with
one file per layer:

```
<module>.controller.ts   HTTP: routing, request/response, Zod validation
<module>.service.ts      business logic, authorisation, orchestration
<module>.repository.ts    data access — the only layer that touches TypeORM
<module>.entity.ts       TypeORM entity definitions (no logic)
```

Hard rules (from `AGENTS.md`): controllers never import repositories; business rules and
authorisation live in services; cross-module reads go through the other module's **service**;
entities carry no logic. Dependencies are wired by hand in `backend/src/app.ts` (no DI container).

**Request lifecycle**

```
Browser (React page)
   │  apiRequest() → fetch, Authorization: Bearer <jwt>
   ▼
Express route
   │  requireAuth  →  requireRole(...)        (authentication + role gate)
   ▼
Controller
   │  Zod validate({ body | params | query })  (reject malformed input, 400)
   ▼
Service
   │  business rules + scope authorisation      (403 / 404 / 409)
   ▼
Repository  (extends BaseRepository)
   │  TypeORM query builder
   ▼
PostgreSQL
```

Errors thrown by any layer are caught by the central handler
(`backend/src/common/middleware/error-handler.ts`) and serialised to a consistent JSON shape:

```json
{ "error": { "message": "..." } }
```

The frontend `apiRequest` reads `error.message` back out of that shape (`frontend/src/api/client.ts`).

---

## 3. Authentication & authorization

**Login.** `POST /auth/login` takes `email` + `password`. The service
(`auth.service.ts`) looks the user up by email, compares the password against the stored bcrypt
hash, and on success signs a JWT carrying `{ userId, role }` with a 24-hour expiry. An unknown
email and a wrong password throw the **same** `InvalidCredentialsError` (401), so the response
never reveals whether an email exists.

**Session restore.** `GET /auth/me` reads the `Authorization: Bearer <token>` header, verifies
the JWT in `requireAuth`, and returns the current user's safe projection (`id`, `email`, `name`,
`role` — never the hash). The frontend calls this on load to rehydrate the session.

**Two places for authorization, never anywhere else:**

- **Role at the route** — `requireAuth` then `requireRole('SUPER_ADMIN', ...)`
  (`backend/src/common/middleware/authenticate.ts`, `authorize.ts`). Missing/expired/malformed
  token → **401**; valid token but wrong role → **403**.
- **Scope in the service** — data is filtered *in the query*, not after it.
  `TeamsService.accessFilterFor(caller)` returns a filter by role: Super Admin sees everything,
  a Team Lead sees teams they lead (`leadId`), an Employee sees teams they are a member of
  (`memberId`). The repository applies it, so out-of-scope rows are never fetched.

> `backend/src/common/authorization/scope.service.ts` (`ScopeService` — `assertTeamLeadOf`,
> `assertMemberOf`, `assertOwnsResource`) is implemented and unit-tested but **not yet wired into
> any route**. It is groundwork for resource-level checks in later phases.

**Access model (Phase 1 surface).** Adapted from `DOMAIN.md` for what exists today:

| | Super Admin | Team Lead | Employee |
| --- | --- | --- | --- |
| Create users | ✅ | — | — |
| List users | ✅ | — | — |
| Create teams | ✅ | — | — |
| List teams | all | teams they lead | teams they belong to |
| View team details | all | own team | own team |
| Add / remove members | ✅ | — | — |
| Assign team lead | ✅ | — | — |

---

## 4. Feature walkthroughs (end to end)

### 4.1 Login & session

```
LoginPage.tsx  ──►  AuthContext.login()  ──►  POST /auth/login
                                                  → { token, user }
   token saved to localStorage['trackit_token']; user held in context
   redirect to /

on app load:
AuthContext (mount) ──► GET /auth/me ──► { user }   (rehydrate)
                        401 → clear token, stay logged out
```

- **UI:** `frontend/src/pages/LoginPage.tsx`, `frontend/src/auth/AuthContext.tsx`,
  `frontend/src/auth/ProtectedRoute.tsx`.
- **Token storage:** JWT in `localStorage` under `trackit_token`. `ProtectedRoute` gates rendering
  while auth resolves, redirects unauthenticated users to `/login`, and redirects users lacking an
  allowed role back to `/`.
- **Backend:** `auth.controller.ts` → `auth.service.ts` → `users.service.ts` (`findByEmail` /
  `findById`).

### 4.2 User management (Super Admin)

```
UsersPage.tsx
  ├─ UserCreationForm ──► POST /users        { name, email, password, role } → { user }
  └─ role filter       ──► GET /users?role=&unassigned= → { users }
```

- **UI:** `frontend/src/pages/UsersPage.tsx`, `frontend/src/components/UserCreationForm.tsx`.
- **Backend:** the whole `users` router is gated `requireAuth` + `requireRole(SUPER_ADMIN)`
  (`users.controller.ts`). `createUser` checks email uniqueness (**409** on duplicate), hashes the
  password with bcrypt, and returns a projection without the hash. `listUsers` supports
  `?role=<ROLE>` and `?unassigned=true` (users in no team); the returned records carry each user's
  `teamId` (or `null`).

### 4.3 Team management (Super Admin + scoped reads)

```
TeamsPage.tsx
  ├─ TeamCreationForm (SA) ──► POST /teams    { name, description?, weeklyCapacityHours? } → { team }
  └─ team list             ──► GET /teams     → { teams }   (role-scoped)

TeamDetailsPage.tsx  ──► GET /teams/:id → { team: { …, lead, members, memberCount } }
  ├─ TeamMemberAssignmentForm ──► POST   /teams/:id/members        { userId } → { member }
  ├─ member removal           ──► DELETE /teams/:id/members/:userId → 204
  └─ TeamLeadSelector         ──► PUT    /teams/:id/lead           { userId } → { lead }
```

- **UI:** `frontend/src/pages/TeamsPage.tsx`, `TeamDetailsPage.tsx`, and the forms in
  `frontend/src/components/`.
- **Backend rules** (`teams.service.ts`):
  - **Create team** — name must be unique (**409** otherwise); capacity defaults to
    `DEFAULT_WEEKLY_CAPACITY` (40); a new team starts with no lead.
  - **List / details** — filtered by `accessFilterFor(caller)`. `getTeamDetails` returns **404**
    if the team does not exist and **403** if it exists but is outside the caller's scope. Details
    include the resolved `lead`, the `members` list, and `memberCount`.
  - **Add member** — the user must exist (**404**) and be an `EMPLOYEE` (**409** otherwise).
    One-team-per-user is enforced: already in this team, or already in another team → **409**
    (see [ADR 0001](adr/0001-one-team-per-user.md)).
  - **Assign lead** — the target must already be a member (**409** otherwise). The repository does
    this transactionally with a pessimistic lock: promote the new user to `TEAM_LEAD`, demote the
    previous lead back to `EMPLOYEE`, and update `teams.lead_id`.
  - **Remove member** — must be a current member (**404** otherwise); the **current lead cannot be
    removed** until another lead is assigned (**409**).

---

## 5. Data model

Three tables, built up across five migrations in `backend/src/migrations/`.

**`users`** (`User`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `email` | text | unique |
| `password_hash` | text | bcrypt |
| `name` | text | |
| `role` | enum `user_role_enum` | `SUPER_ADMIN` \| `TEAM_LEAD` \| `EMPLOYEE` |
| `created_at`, `updated_at` | timestamptz | |

**`teams`** (`Team`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | text | unique |
| `description` | text | default `''` |
| `lead_id` | uuid, nullable | FK → `users.id`, `ON DELETE SET NULL` |
| `weekly_capacity_hours` | double | default 40 |
| `created_at`, `updated_at` | timestamptz | |

**`team_members`** (`TeamMember`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `team_id` | uuid | FK → `teams.id`, `CASCADE` |
| `user_id` | uuid | FK → `users.id`, `CASCADE` |
| `joined_at` | timestamptz | |

Unique constraints: `(team_id, user_id)` and `(user_id)` alone — the second enforces
**one team per user** at the database level.

**Migration history**

| Migration | Purpose |
| --- | --- |
| `1754640000000-InitialSetup` | No-op — bootstraps the TypeORM migrations table |
| `1754640100000-CreateUsers` | `users` table + role enum |
| `1754640200000-CreateTeamsAndMembership` | `teams` table, originally with a `users.team_id` FK |
| `1754640300000-ExpandTeams` | Adds `description`, `weekly_capacity_hours`, timestamps to `teams` |
| `1754640400000-CreateTeamMembers` | Introduces `team_members`, migrates data from `users.team_id`, then **drops `users.team_id`** |

Entities use plain FK columns (not TypeORM relation decorators); joins are written explicitly in
the query builders.

---

## 6. API reference (Phase 1)

All responses are JSON. Errors use `{ "error": { "message": "..." } }`.

| Method | Path | Access | Request | Success | Notable errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | public | `{ email, password }` | `200 { token, user }` | 401 invalid credentials |
| GET | `/auth/me` | authenticated | — | `200 { user }` | 401 |
| POST | `/users` | SUPER_ADMIN | `{ name, email, password, role }` | `201 { user }` | 401, 403, 409 duplicate email |
| GET | `/users` | SUPER_ADMIN | query `role?`, `unassigned?` | `200 { users }` | 401, 403 |
| POST | `/teams` | SUPER_ADMIN | `{ name, description?, weeklyCapacityHours? }` | `201 { team }` | 401, 403, 409 duplicate name |
| GET | `/teams` | authenticated | — | `200 { teams }` (role-scoped) | 401 |
| GET | `/teams/:id` | authenticated | — | `200 { team }` (with lead, members) | 401, 403, 404 |
| POST | `/teams/:id/members` | SUPER_ADMIN | `{ userId }` | `201 { member }` | 401, 403, 404, 409 |
| DELETE | `/teams/:id/members/:userId` | SUPER_ADMIN | — | `204` | 401, 403, 404, 409 lead not reassigned |
| PUT | `/teams/:id/lead` | SUPER_ADMIN | `{ userId }` | `200 { lead }` | 401, 403, 404, 409 not a member |
| GET | `/health` | public | — | `200 { status, database }` | 503 database down |

Passwords must be at least `MIN_PASSWORD_LENGTH` characters (see `constants.ts`); emails are
trimmed and lowercased at the boundary.

---

## 7. Running & verifying end to end

### With Docker Compose (recommended)

```bash
cp backend/.env.example backend/.env   # first time only
docker compose up
```

- Frontend: http://localhost:5173
- API: http://localhost:3000
- PostgreSQL: localhost:5432

### On the host

```bash
# backend
cd backend && cp .env.example .env && npm install && npm run dev
# frontend (separate shell) — set VITE_API_URL to the API base URL
cd frontend && npm install && npm run dev
```

`JWT_SECRET` must be at least 32 characters; env vars are validated at boot
(`backend/src/common/config/env.ts`).

### Migrate and seed

```bash
cd backend
npm run migration:run
npm run seed
```

The seed (`backend/src/scripts/seeds/company-structure.seed.ts`) is **idempotent** — records are
keyed by email and team name, so a second run changes nothing. It creates 2 teams and 9 users;
every account's password is `TrackIt123!`:

| Name | Role | Team | Email |
| --- | --- | --- | --- |
| TrackIt Admin | Super Admin | — | `admin@trackit.local` |
| Priya | Team Lead | Platform Team | `priya@trackit.local` |
| Alex | Employee | Platform Team | `alex@trackit.local` |
| Maya | Employee | Platform Team | `maya@trackit.local` |
| Jordan | Employee | Platform Team | `jordan@trackit.local` |
| Diego | Employee | Platform Team | `diego@trackit.local` |
| Sam | Team Lead | Frontend Team | `sam@trackit.local` |
| Elena | Employee | Frontend Team | `elena@trackit.local` |
| Noah | Employee | Frontend Team | `noah@trackit.local` |

### Verify the API from the command line

```bash
# health — proves route → database
curl http://localhost:3000/health
# → {"status":"ok","database":"up"}

# login → capture the token → restore the session
TOKEN=$(curl -s http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@trackit.local","password":"TrackIt123!"}' | jq -r .token)

curl http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/teams  -H "Authorization: Bearer $TOKEN"
```

### Verify in the browser

Log in at http://localhost:5173/login as `admin@trackit.local`. As Super Admin you can open
**Users** and **Teams**, create a user, create a team, add employees, and assign a lead. Log in as
`priya@trackit.local` (Team Lead) to confirm the team list is scoped to only her team.

### Tests

```bash
cd backend && npm test          # auth, users, teams, middleware, scope service, seed
cd frontend && node --test src/**/*.test.ts   # navigation
```

---

## 8. Known limitations & follow-ups

- **JWT in `localStorage`.** Convenient for this simulation and survives reloads, but exposed to
  XSS. Refresh tokens and production-grade cookie sessions are deliberately out of scope.
- **`ScopeService` is unwired.** Built and tested, but no route uses `assertTeamLeadOf` /
  `assertMemberOf` / `assertOwnsResource` yet — Phase 1 scoping is done entirely through
  `TeamsService.accessFilterFor()` query filters.
- **Doc drift in the root `README.md`.** After TRACKIT-39 the frontend calls the API directly via
  `VITE_API_URL`; the README's "Running the frontend" section still describes the removed Vite
  proxy (`VITE_API_TARGET`, "Vite proxies `/auth` and `/health`"). Noted here as a follow-up — not
  fixed as part of this document.
- **Goal-progress weighting, priority scoring, workload/risk** and the other derived values in
  `DOMAIN.md` belong to later phases and are not implemented.
