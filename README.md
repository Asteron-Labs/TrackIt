# TrackIt

A company-wide task and resource tracking system. Teams have goals, goals have tasks,
tasks are assigned to employees, and employees log time against them. Managers see progress,
workload and delivery risk.

See [`docs/DOMAIN.md`](docs/DOMAIN.md) for the domain model and [`AGENTS.md`](AGENTS.md)
for the engineering rules.

## Stack

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Backend    | Node.js + Express + TypeScript   |
| Frontend   | React + TypeScript + Vite        |
| Database   | PostgreSQL + TypeORM             |
| Validation | Zod (at the controller boundary) |
| Auth       | JWT                              |
| Dev        | Docker Compose                   |

## Architecture — the four-layer convention

The backend is a modular monolith. Every domain module lives under `backend/src/modules/<module>/`
and has exactly four layers, each in its own file:

| File                     | Layer      | Responsibility                                                      |
| ------------------------ | ---------- | ------------------------------------------------------------------- |
| `<module>.controller.ts` | Controller | HTTP: routing, request/response, **Zod validation** at the boundary |
| `<module>.service.ts`    | Service    | Business logic, **authorisation**, orchestration                    |
| `<module>.repository.ts` | Repository | Data access — the only layer that touches TypeORM                   |
| `<module>.entity.ts`     | Entity     | TypeORM entity definition (no logic)                                |

Rules that keep the layers honest (see `AGENTS.md` for the full set):

- **Controllers never import repositories.** They call services.
- **Services receive their repository by constructor injection** and never see the `DataSource`.
- **Validation is a controller concern** (Zod); **authorisation is a service concern**.
- Cross-module reads go through the other module's **service**, never its repository.

The `GET /health` endpoint under `backend/src/health/` demonstrates the flow end to end —
`controller → service → repository → database` — even though, as a liveness probe, it has no
entity of its own. Entity-backed module repositories extend the shared
`backend/src/common/repository/base.repository.ts`.

The eight module folders are filled story by story. TRACKIT-13 implements the `auth` and `users`
foundations; the remaining modules stay empty until their own stories.

## Prerequisites

- Docker + Docker Compose
- Node.js 24+ and npm (only needed to run the backend or migrations outside Docker)

## Running with Docker (recommended)

One command brings up the frontend, API and PostgreSQL:

```bash
cp backend/.env.example backend/.env   # first time only
docker compose up
```

- Frontend: http://localhost:5173
- API: http://localhost:3000
- PostgreSQL: localhost:5432

The API and frontend containers run with hot reload.

### Seeded company structure

After applying migrations, seed the demo users, teams, memberships, and team leads:

```bash
cd backend
npm run migration:run
npm run seed
```

All seeded users use the password `TrackIt123!`:

| Name          | Role        | Team          | Email                  |
| ------------- | ----------- | ------------- | ---------------------- |
| TrackIt Admin | Super Admin | —             | `admin@trackit.local`  |
| Priya         | Team Lead   | Platform Team | `priya@trackit.local`  |
| Alex          | Employee    | Platform Team | `alex@trackit.local`   |
| Maya          | Employee    | Platform Team | `maya@trackit.local`   |
| Jordan        | Employee    | Platform Team | `jordan@trackit.local` |
| Diego         | Employee    | Platform Team | `diego@trackit.local`  |
| Sam           | Team Lead   | Frontend Team | `sam@trackit.local`    |
| Elena         | Employee    | Frontend Team | `elena@trackit.local`  |
| Noah          | Employee    | Frontend Team | `noah@trackit.local`   |

The Platform Team has five members and the Frontend Team has three. The seed command is
idempotent: records are identified by stable email addresses and team names, and a second run
does not recreate them or reassign existing relationships. Passwords are stored only as bcrypt
hashes.

### Authentication API

`POST /auth/login` accepts `email` and `password`, returning a 24-hour JWT and safe user
projection. `GET /auth/me` accepts `Authorization: Bearer <token>` and restores that projection.
Wrong passwords and unknown emails deliberately return the same `401` response.

The frontend stores the JWT in `localStorage` for this simulation. This survives reloads and is
simple to inspect, but an XSS vulnerability could expose the token. Refresh tokens and
production-grade cookie sessions are outside this story.

### Health check

Proves the full stack from route to database:

```bash
curl http://localhost:3000/health
# 200 -> {"status":"ok","database":"up"}
# 503 -> {"status":"error","database":"down"}
```

## Database migrations

Schema changes go through TypeORM migrations only (`synchronize` is off). Run these from
`backend/` (or inside the `api` container). They require the database to be running.

```bash
cd backend
npm run migration:run      # apply pending migrations
npm run migration:revert   # roll back the most recent migration
npm run migration:create -- src/migrations/<Name>   # scaffold a new migration
```

The initial no-op migration proves the tooling. TRACKIT-13 adds the first real schema migration
for users and roles.

## Running the backend on the host

```bash
cd backend
cp .env.example .env        # point POSTGRES_HOST at a reachable database
npm install
npm run dev                 # hot-reloading dev server
```

Other scripts:

```bash
npm run build               # type-check and compile to dist/
npm start                   # run the compiled build
npm run lint                # ESLint
npm run format              # Prettier
npm test                    # authentication unit tests
npm run seed                # create the demo company structure
```

## Running the frontend on the host

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/auth` and `/health` to `http://localhost:3000` by default. Set
`VITE_API_TARGET` when the API is available elsewhere.

## Configuration

- Machine/deployment settings (port, database connection) are read from the environment
  and validated at boot — see `backend/src/common/config/env.ts`.
- `JWT_SECRET` must contain at least 32 characters.
- Tunable domain constants live in `backend/src/common/config/constants.ts` and are never
  inlined elsewhere.

## Project layout

```
.
├── docker-compose.yml          # frontend + api + postgres
├── docs/DOMAIN.md              # domain model and vocabulary
├── AGENTS.md                   # engineering rules
├── backend/
    ├── Dockerfile
    └── src/
        ├── index.ts            # entrypoint: init DataSource, start server
        ├── app.ts             # Express app: middleware, routes, error handler
        ├── data-source.ts      # TypeORM DataSource
        ├── common/
        │   ├── config/         # env (validated) + domain constants
        │   ├── errors/         # domain error hierarchy
        │   └── middleware/     # Zod validation + centralised error handler
        ├── health/             # GET /health (route -> database)
        ├── migrations/         # TypeORM migrations
        └── modules/            # auth, users, teams, goals, tasks,
                                # timesheets, dashboards, audit
└── frontend/
    └── src/                    # React auth context, routes, pages and navigation
```
