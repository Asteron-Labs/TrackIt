# TrackIt

A company-wide task and resource tracking system. Teams have goals, goals have tasks,
tasks are assigned to employees, and employees log time against them. Managers see progress,
workload and delivery risk.

See [`docs/DOMAIN.md`](docs/DOMAIN.md) for the domain model and [`AGENTS.md`](AGENTS.md)
for the engineering rules.

## Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Backend    | Node.js + Express + TypeScript      |
| Database   | PostgreSQL + TypeORM                |
| Validation | Zod (at the controller boundary)    |
| Auth       | JWT _(from TRACKIT-13 onward)_      |
| Dev        | Docker Compose                      |

> The frontend (React + TypeScript) is scaffolded in a later step and is not yet part of
> this repository or the Compose stack.

## Architecture — the four-layer convention

The backend is a modular monolith. Every domain module lives under `backend/src/modules/<module>/`
and has exactly four layers, each in its own file:

| File | Layer | Responsibility |
| --- | --- | --- |
| `<module>.controller.ts` | Controller | HTTP: routing, request/response, **Zod validation** at the boundary |
| `<module>.service.ts` | Service | Business logic, **authorisation**, orchestration |
| `<module>.repository.ts` | Repository | Data access — the only layer that touches TypeORM |
| `<module>.entity.ts` | Entity | TypeORM entity definition (no logic) |

Rules that keep the layers honest (see `AGENTS.md` for the full set):

- **Controllers never import repositories.** They call services.
- **Services receive their repository by constructor injection** and never see the `DataSource`.
- **Validation is a controller concern** (Zod); **authorisation is a service concern**.
- Cross-module reads go through the other module's **service**, never its repository.

The `GET /health` endpoint under `backend/src/health/` demonstrates the flow end to end —
`controller → service → repository → database` — even though, as a liveness probe, it has no
entity of its own. Entity-backed module repositories extend the shared
`backend/src/common/repository/base.repository.ts`.

The eight module folders (`auth`, `users`, `teams`, `goals`, `tasks`, `timesheets`,
`dashboards`, `audit`) are committed empty; each story fills in its own module.

## Prerequisites

- Docker + Docker Compose
- Node.js 24+ and npm (only needed to run the backend or migrations outside Docker)

## Running with Docker (recommended)

One command brings up the API and PostgreSQL:

```bash
cp backend/.env.example backend/.env   # first time only
docker compose up
```

- API: http://localhost:3000
- PostgreSQL: localhost:5432

The API container runs with hot reload — edits under `backend/src` restart it automatically.

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

The repository ships one intentionally empty migration so the tooling is proven to run
and revert. Real schema arrives with the first entity story.

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
```

## Configuration

- Machine/deployment settings (port, database connection) are read from the environment
  and validated at boot — see `backend/src/common/config/env.ts`.
- Tunable domain constants live in `backend/src/common/config/constants.ts` and are never
  inlined elsewhere.

## Project layout

```
.
├── docker-compose.yml          # api + postgres, one-command startup
├── docs/DOMAIN.md              # domain model and vocabulary
├── AGENTS.md                   # engineering rules
└── backend/
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
```
