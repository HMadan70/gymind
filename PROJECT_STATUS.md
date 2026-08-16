# Gymind — Project Documentation

_Last updated: 2026-08-17_

A fitness tracking app being built from scratch, learning as I go. This doc is the single source of truth for the project — architecture, what's built, what's planned, and how the dev workflow works.

---

## 1. Overview

- **Name:** Gymind
- **Purpose:** Fitness tracking app — workouts, nutrition, progress, and (eventually) an AI coach
- **Developer:** Solo, beginner, learning as the project goes
- **Repo:** `https://github.com/HMadan70/gymind`

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | Python / FastAPI | REST API |
| Database | PostgreSQL 16 | Runs in Docker |
| Mobile / Web | React Native + React Native Web | Not started yet — will share code between mobile app and web |
| Auth | JWT (JSON Web Tokens) | Passwords hashed with bcrypt via passlib |
| Deployment | Docker Compose, self-hosted | Runs on a home server (ZimaOS) |

---

## 3. Architecture

```
┌─────────────────────┐
│  React Native App    │  (planned)
│  React Native Web    │  (planned)
└──────────┬───────────┘
           │ HTTPS / REST
           ▼
┌─────────────────────┐
│  FastAPI backend      │  Docker container "backend"
│  (host port 8001 →    │
│   container port 8000)│
└──────────┬───────────┘
           │ SQL
           ▼
┌─────────────────────┐
│  PostgreSQL 16         │  Docker container "db"
│  (host port 5433 →    │
│   container port 5432)│
└─────────────────────┘
```

Everything runs via `docker-compose.yml` on the home server. Ports are remapped from Postgres/FastAPI defaults (5432/8000) because other containers on the server already use those.

---

## 4. Repo Structure

```
gymind/
├── backend/        # FastAPI app
│   ├── ...
├── mobile/         # React Native app (not built yet)
├── docker-compose.yml
└── PROJECT_STATUS.md
```

---

## 5. Local Dev Environment Setup

_(Fill in exact commands as you formalize this — placeholder based on stack so far.)_

1. Clone the repo: `git clone https://github.com/HMadan70/gymind.git`
2. Install backend dependencies (inside `/backend`), likely via `pip install -r requirements.txt` — confirm this file exists / create it if not
3. Copy `.env.example` → `.env` and fill in local values (see Section 12 below) — confirm this exists / create it
4. Bring up containers: `docker compose up -d --build`
5. Confirm it's alive: `curl http://192.168.0.241:8001/health`
6. Confirm DB connectivity: `curl http://192.168.0.241:8001/health/db`

**TODO:** actually create a `requirements.txt` and `.env.example` if they don't exist yet, and pin dependency versions (see Section 13).

---

## 6. Deployment & Server Access

- **Server OS:** ZimaOS (Docker-based)
- **SSH access:** `ssh root@192.168.0.241`
- **Containers:**
  - `db` — Postgres 16, `5433:5432`
  - `backend` — FastAPI, `8001:8000`
- **DB GUI access:** TablePlus → host `192.168.0.241`, port `5433`
- **Server git policy:** server only ever runs `git pull` — never commits or pushes. All code changes happen on dev laptops.
- **Restart after a pull:** `docker compose up -d --build` (rebuilds the backend image if code changed)

---

## 7. Multi-Device Dev Workflow

Two laptops (MSI and Dell), each with its own independent clone:

- Clone path (both machines): `Desktop\Server project\gymind`
- Deliberately **outside** any OneDrive-synced folder, so OneDrive doesn't try to sync/lock git's `.git` internals
- Standard loop on either machine:
  1. `git pull`
  2. Make changes
  3. `git add .`
  4. `git commit -m "..."`
  5. `git push`
- Server: SSH in, `git pull`, restart containers if needed (`docker compose up -d --build`)

---

## 8. Database Schema

### `users` — built
| Column | Type | Notes |
|---|---|---|
| `id` | int/serial | Primary key |
| `email` | text | Unique |
| `username` | text | Unique |
| `password_hash` | text | bcrypt hash via passlib |
| `created_at` | timestamp | Default now() |

### `user_profiles` — planned, not built
Draft fields (to be finalized):
| Column | Type (draft) | Notes |
|---|---|---|
| `id` | int/serial | Primary key |
| `user_id` | int (FK → users.id) | One profile per user |
| `goal` | text or enum | e.g. "lose weight", "build muscle", "maintain" |
| `experience_level` | text or enum | beginner / intermediate / advanced |
| `injuries` | text (free-form) or a related table | Needs design decision — see Section 15 |
| `equipment` | text[] or related table | e.g. "dumbbells", "barbell", "none" |
| `dietary_restrictions` | text[] or related table | e.g. "vegetarian", "gluten-free" |
| `created_at` | timestamp | Default now() |
| `updated_at` | timestamp | Update on edit |

### `workouts` — not designed yet
Will need at minimum: workout sessions, exercises performed, sets/reps/weight per exercise, timestamps.

### `nutrition_logs` — not designed yet
Will need at minimum: meal entries, food items, macros, timestamps.

---

## 9. API Reference

### Auth
| Method | Path | Status | Description |
|---|---|---|---|
| POST | `/auth/register` | ✅ Built | Creates a user, hashes password with bcrypt |
| POST | `/auth/login` | ✅ Built | Login by email or username, returns signed JWT |
| — | `get_current_user` dependency | 🔧 In progress | Reads JWT from `Authorization` header, validates it, returns the current `User` for protected routes |

### Health
| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/health` | ✅ Built | Basic liveness check |
| GET | `/health/db` | ✅ Built | Checks DB connectivity |

### Planned
| Method | Path | Status | Description |
|---|---|---|---|
| GET/POST | `/users/profile` | ❌ Not built | Read/create/update `user_profiles` |
| GET/POST | `/workouts` | ❌ Not built | List/create workout sessions |
| GET/PUT/DELETE | `/workouts/{id}` | ❌ Not built | Get/update/delete a specific workout |
| GET/POST | `/nutrition` | ❌ Not built | List/create nutrition log entries |
| GET | `/progress` | ❌ Not built | Aggregated stats/trends |
| POST | `/coach` | ❌ Not built | AI coach interaction endpoint |

---

## 10. Key Technical Decisions & Gotchas

- **bcrypt pinned to `4.0.1`** — needed for compatibility with `passlib==1.7.4`. If either is upgraded later, re-verify password hashing still works before deploying.
- **Non-default ports** (`5433` for Postgres, `8001` for backend) — because other containers on the home server already occupy the defaults. Keep this in mind in `.env` files, TablePlus configs, and any new service that needs to talk to these.
- **Git & OneDrive** — repo clones are intentionally kept outside OneDrive sync folders to avoid `.git` corruption/conflicts from cloud sync.
- **Server never commits** — treat the server as a deploy target only, not a place to edit code.

---

## 11. Roadmap — Detailed Developer Tasks

### Phase 1 — Auth & Users (current)
- [x] `users` table
- [x] Register / login endpoints
- [x] JWT issuing on login
- [ ] **JWT route protection**
  - [ ] Write `get_current_user` dependency: extract `Authorization: Bearer <token>` header
  - [ ] Decode/verify JWT signature and expiry
  - [ ] Look up user by id from token payload; raise `401` if invalid/missing/expired
  - [ ] Apply `Depends(get_current_user)` to a test route to confirm it works end-to-end
  - [ ] Decide token expiry length and whether refresh tokens are needed later
- [ ] **`user_profiles` table**
  - [ ] Finalize schema (see open question on injuries/equipment structure, Section 15)
  - [ ] Write migration (or manual `CREATE TABLE` if not using a migration tool yet)
  - [ ] Build `POST /users/profile` (create/update, requires auth)
  - [ ] Build `GET /users/profile` (requires auth, returns current user's profile)
  - [ ] Decide: is profile creation mandatory before using the rest of the app (onboarding gate)?

### Phase 2 — Core Tracking
- [ ] **Workouts**
  - [ ] Design `workouts`, `exercises`, and `workout_sets` tables (or similar normalized structure)
  - [ ] `POST /workouts` — create a workout session
  - [ ] `GET /workouts` — list past workouts for current user
  - [ ] `GET /workouts/{id}` — workout detail
  - [ ] `PUT /workouts/{id}` — edit
  - [ ] `DELETE /workouts/{id}` — delete
  - [ ] Decide on exercise list source: user-defined only, or a seeded reference table of common exercises?
- [ ] **Nutrition**
  - [ ] Design `nutrition_logs` schema
  - [ ] Decide: manual macro entry vs. food database API lookup (see open question, Section 15)
  - [ ] CRUD endpoints mirroring the workouts pattern
- [ ] **Progress**
  - [ ] Design aggregation queries (e.g. weekly volume, weight trend)
  - [ ] `GET /progress` endpoint returning summarized stats
  - [ ] Decide what "progress" surfaces first — simplest useful version, not everything at once

### Phase 3 — Mobile App
- [ ] Scaffold React Native + React Native Web project in `/mobile`
- [ ] Set up shared navigation (React Navigation or similar)
- [ ] Build register/login screens wired to `/auth/*`
- [ ] Build onboarding screen wired to `/users/profile`
- [ ] Build core workout logging UI
- [ ] Decide on state management approach (Context API vs. something like Zustand/Redux) once the app has enough shared state to justify it

### Phase 4 — AI Coach
- [ ] Define scope: chat-based Q&A vs. auto-generated plans vs. both
- [ ] Choose LLM integration approach (API-based, likely)
- [ ] Design how profile + logged data feeds into coach context
- [ ] Build `POST /coach` endpoint

### Cross-cutting / ongoing tasks
- [ ] Set up `requirements.txt` with pinned versions for the backend
- [ ] Set up `.env.example` documenting required environment variables
- [ ] Add basic input validation/error handling conventions (see Section 13)
- [ ] Add at least minimal tests for auth endpoints before building more on top
- [ ] Decide on a migration tool (e.g. Alembic) before the schema grows much further, so schema changes are tracked rather than manual

---

## 12. Environment Variables (draft — confirm against actual `.env`)

| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Should point at `db:5432` inside Docker network, not `localhost:5433` |
| `JWT_SECRET_KEY` | Signing key for JWTs | Keep out of git; confirm it's in `.env`, not hardcoded |
| `JWT_ALGORITHM` | e.g. `HS256` | Confirm what's actually used |
| `JWT_EXPIRE_MINUTES` | Token lifetime | Confirm current value |

**TODO:** verify this table against the actual backend config once shared — this is a placeholder based on typical FastAPI+JWT setups, not confirmed values.

---

## 13. Conventions & Practices (to establish)

- **Error handling:** decide on a consistent pattern for returning errors (FastAPI `HTTPException` with consistent status codes/messages)
- **Validation:** use Pydantic models for all request/response bodies (likely already doing this for register/login — extend the pattern going forward)
- **Testing:** no test suite yet — consider `pytest` + FastAPI's `TestClient` starting with auth endpoints
- **Migrations:** no migration tool yet — consider Alembic before schema grows further, so changes are tracked and repeatable across devices/server instead of manual SQL
- **Dependency pinning:** pin versions in `requirements.txt` to avoid surprises like the bcrypt/passlib issue recurring elsewhere

---

## 14. Glossary (for learning-as-I-go reference)

- **JWT (JSON Web Token):** A signed piece of data the server gives the client after login, proving who they are on future requests, without the server needing to store session state.
- **Dependency (FastAPI):** A function FastAPI runs automatically before your route logic, and injects its return value as an argument — used for things like auth checks.
- **bcrypt:** An algorithm for securely hashing passwords so raw passwords are never stored.
- **Docker Compose:** A tool for defining and running multiple linked containers (e.g. a database + an API) together via one config file.
- **Host port vs container port:** The container's internal port (e.g. 5432) vs the port exposed on the actual server machine (e.g. 5433) — they can differ, which is why you sometimes need to specify both.
- **Migration (database):** A version-controlled, repeatable script that changes your DB schema (e.g. adding a table/column), so schema changes can be tracked and applied consistently across environments instead of run manually and forgotten.
- **Pydantic model:** A Python class (used heavily by FastAPI) that defines the shape and validation rules of request/response data.

---

## 15. Open Questions / Ideas (not committed yet)

- Should `injuries` and `equipment` in `user_profiles` be free-text, arrays, or their own related tables (more structured, more work upfront)?
- Should nutrition tracking use a food database API, or manual entry only, to start?
- What does "AI coach" mean concretely — chat interface? Auto-generated workout plans? Both?
- Should exercises come from a seeded reference table, or be entirely user-defined?
- When to introduce a migration tool (Alembic) — now, or once the schema stabilizes a bit more?
- Is a full test suite worth setting up now, or after the API surface is bigger?
