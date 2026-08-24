# Gymind — Project Documentation

_Last updated: 2026-08-21_

A fitness tracking app being built from scratch, learning as I go. This doc is the single source of truth for the project — architecture, what's built, what's planned, dev workflow, and the full design system.

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
| Mobile / Web | React Native + React Native Web | Not started yet — full visual design now complete, ready to begin implementation |
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
├── backend/               # FastAPI app
│   └── ...
├── mobile/                # React Native app (not built yet)
├── Design/
│   ├── exports/           # Final screen images
│   │   ├── mobile/        # 9 mobile screens
│   │   ├── web/           # 9 web screens
│   │   ├── base-token-reference.png
│   │   └── theming-comparison-grid.png
│   └── Source/            # Claude Design source files (.dc, support.js)
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

**Also decided:** while actively developing (e.g. JWT work), run FastAPI locally with `uvicorn --reload` for fast iteration, rather than push → SSH → rebuild each change. Push to the server only once a feature is tested and working.

**Reminder — `.env` is per-machine, not per-repo:** since `backend/.env` is gitignored, every device (including a freshly set-up MSI) needs it created manually before `uvicorn` will run locally — a missing `.env` shows up as `DATABASE_URL` being `None` at `create_engine()` time. See Section 10 for the full gotcha and Section 12 for the required variables.

---

## 6. Deployment & Server Access

- **Server OS:** ZimaOS (Docker-based)
- **SSH access:** `ssh root@192.168.0.241`
- **Repo path on server:** `/DATA/gymind`
- **Containers:**
  - `db` — Postgres 16, `5433:5432` (container name: `gymind-db`)
  - `backend` — FastAPI, `8001:8000` (container name: `gymind-backend`)
  - _Note: a separate, unrelated `postgres:17.4` container also runs on this server on the default `5432` port — not part of Gymind, don't confuse the two when running `docker ps`._
- **DB GUI access:** TablePlus → host `192.168.0.241`, port `5433`
- **Server git policy:** server only ever runs `git pull` — never commits or pushes. All code changes happen on dev laptops.
- **Restart after a pull:** `docker compose up -d --build` (rebuilds the backend image if code changed; not needed for doc-only changes)
- **Resetting the `gymind` DB user's password (if needed):** `docker exec -it gymind-db psql -U gymind -d gymind`, then `ALTER USER gymind WITH PASSWORD 'newpassword';`

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
- Both laptops now have the repo open in VS Code

**Current setup note:** two-device workflow — Dell as primary, MSI as secondary — each cloning independently from GitHub. There is no device-to-device syncing; GitHub is the sole source of truth, so `git pull`/`git push` is the only way changes move between machines. Both folders currently still sit inside OneDrive paths on both machines (known risk — not urgent, but see Section 10's OneDrive gotcha for why the clone path was originally meant to avoid this).

**PowerShell + curl gotcha:** on Windows, plain `curl` is aliased to `Invoke-WebRequest`, which parses `-H`/`-d` differently and breaks on JSON bodies. Use `curl.exe` to get real curl — but even then, inline `-d '{"json": "here"}'` bodies can get mangled by PowerShell's own quote handling. The reliable fix: write the JSON to a file and pass it with `-d "@filename.json"`, e.g.:
```powershell
'{"identifier": "test", "password": "testpass123"}' | Out-File -Encoding utf8 login_test.json
curl.exe -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "@login_test.json"
```

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

### `user_profiles` — ✅ built
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `user_id` | int (FK → users.id) | Unique — one profile per user |
| `goal` | text, nullable | e.g. "lose weight", "build muscle", "maintain" |
| `experience_level` | text, nullable | beginner / intermediate / advanced |
| `injuries` | text, nullable | Free-form |
| `equipment` | text[], nullable | e.g. "dumbbells", "barbell", "none" |
| `dietary_restrictions` | text[], nullable | e.g. "vegetarian", "gluten-free" |
| `created_at` | timestamptz | Default now() |
| `updated_at` | timestamptz | Default now(), updates on change |

**This table is now the gate for onboarding completion** — see Section 10, "Onboarding gate."

### `user_preferences` — ✅ built
Supports the theming system (Section 14):
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `user_id` | int (FK → users.id) | Unique — one row per user |
| `theme_mode` | text, nullable | "dark" or "light" |
| `accent_preset` | text, nullable | One of: Ember, Signal, Amber, Violet, Teal, Volt |
| `created_at` | timestamptz | Default now() |
| `updated_at` | timestamptz | Default now(), updates on change |

### `user_workouts` — ✅ Built (models, schemas, and routes)
One row per workout session.
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `user_id` | int (FK → users.id) | Owning user |
| `started_at` | timestamptz | Default now() |
| `ended_at` | timestamptz, nullable | Set when the session is finished |

### `workout_sets` — ✅ Built (models, schemas, and routes)
One row per logged set — see Section 10 for why sets aren't grouped/collapsed.
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `workout_id` | int (FK → user_workouts.id) | Parent workout session |
| `exercise_name` | text | Not null |
| `set_number` | int | Not null — this set's position within the exercise |
| `weight` | float, nullable | |
| `reps` | int, nullable | |

Still open: `exercises` as a seeded reference table vs. user-defined only, session duration/target-weight display, and e1RM computed on write vs. on read (see Section 17).

### `nutrition_logs` — not designed yet
Will need at minimum: meal entries, food items, macros (protein/carbs/fat), timestamps. Design screens show a daily calorie ring + macro bars against a target, so we'll also need a per-user daily calorie/macro target (likely lives in `user_profiles` or its own targets table).

### `body_weight_logs` — not designed yet
Needed for the Progress screen's body weight chart. At minimum: user_id, weight, unit (lb/kg), logged_at timestamp.

---

## 9. API Reference

### Auth
| Method | Path | Status | Description |
|---|---|---|---|
| POST | `/auth/register` | ✅ Built | Creates a user, hashes password with bcrypt |
| POST | `/auth/login` | ✅ Built | Login by email or username, returns signed JWT |
| — | `get_current_user` dependency (`auth.py`) | ✅ Built | Reads JWT from `Authorization` header, validates it, returns the current `User` for protected routes — tested and working, verified both locally and on the deployed server |
| — | `require_profile` dependency (`auth.py`) | ✅ Built | Wraps `get_current_user`: also requires a `user_profiles` row to exist for the current user, raising `403` if not. Use on any route that assumes profile data exists. See Section 10, "Onboarding gate." |
| GET | `/users/me` | ✅ Built | Protected test route confirming `get_current_user` works end-to-end |
| GET | `/users/onboarding-check` | ✅ Built | Uses `require_profile`. Returns `{"status": "profile complete", "user_id": ...}` on success, or `403` if the user hasn't completed onboarding. Kept as a real route (not just a test) — intended for the frontend to call after login to decide whether to route to Onboarding or Home. |

### User
| Method | Path | Status | Description |
|---|---|---|---|
| GET/POST | `/users/profile` | ✅ Built | Read/create/update `user_profiles`. Uses `get_current_user` (not `require_profile`) — this is the route that creates the profile, so it can't require one to already exist. |
| GET/POST | `/users/preferences` | ✅ Built | Theme mode + accent color. **Now uses `require_profile`, not `get_current_user`** — a user must complete onboarding before setting theme/accent preferences. |

### Health
| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/health` | ✅ Built | Basic liveness check |
| GET | `/health/db` | ✅ Built | Checks DB connectivity |

### Workouts
| Method | Path | Status | Description |
|---|---|---|---|
| POST | `/workouts` | ✅ Built | Creates a new workout session for the current user. Uses `require_profile`. |
| GET | `/workouts` | ✅ Built | Lists workout sessions for the current user. Uses `require_profile`. |
| PUT | `/workouts/{id}` | ✅ Built | Marks a workout session finished by setting `ended_at`. Uses `require_profile`; checks `user_id` ownership before modifying. |
| POST | `/workouts/{id}/sets` | ✅ Built | Logs a set against a workout session. Uses `require_profile`; checks `user_id` ownership before modifying. |
| GET | `/workouts/{id}` | ✅ Built | Workout detail with nested `sets`. Uses `require_profile`; checks `user_id` ownership before returning. |

### Planned
| Method | Path | Status | Description |
|---|---|---|---|
| GET/POST | `/nutrition` | ❌ Not built | List/create nutrition log entries. Will use `require_profile` once built. |
| GET/POST | `/body-weight` | ❌ Not built | Log/list body weight entries for Progress chart |
| GET | `/progress` | ❌ Not built | Aggregated stats/trends — scoped per design: body weight trend, e1RM trend per exercise, muscle-group strength summary |
| POST | `/coach` | ❌ Not built | AI coach interaction endpoint — chat UI is fully designed, backend/LLM integration not started |

---

## 10. Key Technical Decisions & Gotchas

- **bcrypt pinned to `4.0.1`** — needed for compatibility with `passlib==1.7.4`. If either is upgraded later, re-verify password hashing still works before deploying.
- **Non-default ports** (`5433` for Postgres, `8001` for backend) — because other containers on the home server already occupy the defaults. Keep this in mind in `.env` files, TablePlus configs, and any new service that needs to talk to these.
- **Git & OneDrive** — repo clones were originally intended to be kept outside OneDrive sync folders to avoid `.git` corruption/conflicts from cloud sync. In practice both current devices still have their clones inside OneDrive paths — not urgent to fix, but a known risk worth revisiting.
- **Server never commits** — treat the server as a deploy target only, not a place to edit code.
- **Theming is presentation-only** — theme/accent changes affect color tokens only; layout, spacing, and typography never change per theme. Worth keeping this discipline in the actual React Native implementation (e.g. a single theme context object, not per-component conditional styling).
- **`psycopg` (v3), not `psycopg2-binary`** — `psycopg2-binary` failed to build locally (no prebuilt package available for the Python version in use). `requirements.txt` now uses `psycopg[binary]`. Critically: any `DATABASE_URL` must explicitly use the `postgresql+psycopg://` prefix, not plain `postgresql://` — otherwise SQLAlchemy defaults to the old psycopg2 driver and crashes with `ModuleNotFoundError`. This caused a real production crash on the server until `docker-compose.yml`'s `DATABASE_URL` was fixed to match.
- **Local dev needs its own `backend/.env`** (gitignored, never committed), with `load_dotenv()` added to `database.py` — Docker doesn't need this since `docker-compose.yml` injects env vars directly, but running `uvicorn` locally does. Local `DATABASE_URL` points directly at the server's Postgres (`192.168.0.241:5433`) rather than a separate local database. **A missing `.env` on a newly set-up machine shows up as `sqlalchemy.exc.ArgumentError: Expected string or URL object, got None`** at `create_engine()` — that's the signal to go create it, not a code bug.
- **Onboarding gate (decided):** profile creation is now mandatory before accessing the rest of the app, enforced on both frontend (later, Phase 3) and backend (now). Backend enforcement is the `require_profile` dependency in `auth.py` — it wraps `get_current_user` and additionally checks for a `user_profiles` row, raising `403 Profile setup required before accessing this feature.` if missing. `/users/preferences` was also brought under this gate (a user must finish onboarding before setting theme/accent). `/users/profile` itself deliberately stays on plain `get_current_user`, since gating it would make onboarding impossible. Apply `require_profile` to `/workouts`, `/nutrition`, `/body-weight`, and `/progress` as they're built in Phase 2.
- **PowerShell/curl quoting** — see Section 7 for the working pattern (`-d "@file.json"`) after several failed attempts at inline `-d '{"..."}'` bodies.
- **`workout_sets` stores one row per set, not a text blob** — weight/reps are normalized numeric columns rather than crammed into a free-form field, specifically so the Progress screen's e1RM chart (Section 15) can query numeric weight/reps per set directly.
- **Pydantic `from_attributes = True` is required for ORM-returning schemas** — any `Out` schema constructed from a raw SQLAlchemy object (especially nested ones, like `WorkoutSetOut` inside `UserWorkoutDetail`) needs this config, or you get `pydantic_core.ValidationError` expecting a dict instead of a model instance. Found and fixed on `WorkoutSetOut`/`UserWorkoutOut` while building the workout routes.
- **Fixed:** `POST /workouts/{id}/sets` previously allowed logging a set into an already-finished workout (i.e. `ended_at` already set) — nothing blocked it. A `409` guard was added that checks `workout.ended_at` before allowing a new set. Tested end-to-end: blocked on finished workouts, allowed on in-progress ones. Deployed.

---

## 11. Roadmap — Detailed Developer Tasks

### Phase 1 — Auth & Users (current)
- [x] `users` table
- [x] Register / login endpoints
- [x] JWT issuing on login
- [x] **JWT route protection**
  - [x] Write `get_current_user` dependency: extract `Authorization: Bearer <token>` header
  - [x] Decode/verify JWT signature and expiry
  - [x] Look up user by id from token payload; raise `401` if invalid/missing/expired
  - [x] Apply `Depends(get_current_user)` to a test route to confirm it works end-to-end
  - [ ] Decide token expiry length and whether refresh tokens are needed later — current expiry is 7 days
- [x] **`user_profiles` table**
  - [x] Finalize schema (see open question on injuries/equipment structure, Section 17)
  - [x] Write migration (or manual `CREATE TABLE` if not using a migration tool yet)
  - [x] Build `POST /users/profile` (create/update, requires auth)
  - [x] Build `GET /users/profile` (requires auth, returns current user's profile)
  - [x] Decide: is profile creation mandatory before using the rest of the app (onboarding gate)? **Yes — decided and implemented (backend). See Section 10.**
- [x] **`user_preferences` table**
  - [x] Design schema (theme_mode, accent_preset)
  - [x] Build `GET/POST /users/preferences`
- [x] **Onboarding gate (backend)**
  - [x] Write `require_profile` dependency in `auth.py`
  - [x] Apply to `/users/preferences` (GET and POST)
  - [x] Build `GET /users/onboarding-check` for the frontend to query post-login
  - [x] Tested end-to-end: registered a fresh user with no profile, confirmed `403` on gated routes, confirmed `200` after profile exists
  - [ ] Apply `require_profile` to Phase 2 routes as they're built (`/workouts`, `/nutrition`, `/body-weight`, `/progress`)
  - [ ] Implement the frontend half of the gate once `/mobile` exists (Phase 3)

### Phase 2 — Core Tracking
- [ ] **Workouts**
  - [x] Design `workouts`, `exercises`, and `workout_sets` tables (or similar normalized structure) — **implemented as a two-table design: `user_workouts` for sessions, `workout_sets` for individual sets, normalized so each set is its own row for the Progress screen's e1RM chart (Section 15). See Section 8.**
  - [x] `POST /workouts` — create a workout session
  - [x] `GET /workouts` — list past workouts for current user
  - [x] `PUT /workouts/{id}` — implemented as finish-a-session (sets `ended_at`), not a general edit route — a broader edit endpoint may still be needed later
  - [x] `POST /workouts/{id}/sets` — log a set against a workout session
  - [x] `GET /workouts/{id}` — workout detail with nested sets
  - [x] Fixed: `POST /workouts/{id}/sets` no longer allows logging sets on a finished workout — `409` guard on `ended_at`, tested end-to-end, deployed. See Section 10.
  - [ ] `DELETE /workouts/{id}` — delete
  - [ ] Decide on exercise list source: user-defined only, or a seeded reference table of common exercises?
  - [ ] Decide on e1RM formula (e.g. Epley) and whether it's computed on write or on read
- [ ] **Nutrition**
  - [ ] Design `nutrition_logs` schema
  - [ ] Decide: manual macro entry vs. food database API lookup
  - [ ] CRUD endpoints mirroring the workouts pattern
  - [ ] Decide where daily calorie/macro targets live (per-user setting)
- [ ] **Body weight tracking**
  - [ ] Design `body_weight_logs` schema
  - [ ] CRUD endpoints
- [ ] **Progress**
  - [ ] Design aggregation queries: body weight trend, e1RM trend per exercise, muscle-group strength summary, simple consistency count
  - [ ] `GET /progress` endpoint(s) returning this data, shaped for the charts already designed

### Phase 3 — Mobile App
- [x] Full visual design complete for all 8 core screens + AI Coach chat, mobile and web (Sections 14–16)
- [ ] Scaffold React Native + React Native Web project in `/mobile`
- [ ] Set up shared navigation (React Navigation or similar) — nav structure already decided: Home, Coach, Workout, Nutrition, Progress, Settings
- [ ] Implement theme system as a single context/provider (dark/light + 6 accent presets), matching the token contract in Section 14
- [ ] Build register/login screens wired to `/auth/*`
- [ ] Build onboarding screen wired to `/users/profile`, with post-login redirect logic based on `GET /users/onboarding-check`
- [ ] Build core workout logging UI
- [ ] Build Home screen (streak strip, AI Coach card, Nutrition card, Workout card)
- [ ] Build Progress screen with drillable muscle-group → exercise → e1RM chart
- [ ] Decide on state management approach (Context API vs. something like Zustand/Redux) once the app has enough shared state to justify it
- [ ] Design still open: empty states, loading/error states, exact icon set, where Profile lives now it's off the bottom nav (see Section 17)

### Phase 4 — AI Coach
- [x] Chat UI fully designed (mobile + web) — message thread, quick-prompt chips, contextual Home card tie-in
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
| `DATABASE_URL` | Postgres connection string | Must use `postgresql+psycopg://` prefix (see Section 10). Local dev points directly at `192.168.0.241:5433`, not `localhost`. |
| `JWT_SECRET` | Signing key for JWTs | Keep out of git; confirm it's in `.env`, not hardcoded. **Note: the actual variable name used in code is `JWT_SECRET`, not `JWT_SECRET_KEY`.** |
| `JWT_ALGORITHM` | e.g. `HS256` | Confirm what's actually used |
| `JWT_EXPIRE_MINUTES` | Token lifetime | Confirm current value |

**TODO:** verify this table against the actual backend config once shared — this is a placeholder based on typical FastAPI+JWT setups, not confirmed values.

---

## 13. Conventions & Practices (to establish)

- **Error handling:** decide on a consistent pattern for returning errors (FastAPI `HTTPException` with consistent status codes/messages). One convention now in place: `401` = not authenticated (bad/missing/expired JWT), `403` = authenticated but not allowed yet (e.g. `require_profile` gate). Keep this distinction for future routes.
- **Validation:** use Pydantic models for all request/response bodies (likely already doing this for register/login — extend the pattern going forward)
- **Testing:** no test suite yet — consider `pytest` + FastAPI's `TestClient` starting with auth endpoints
- **Migrations:** no migration tool yet — consider Alembic before schema grows further, so changes are tracked and repeatable across devices/server instead of manual SQL
- **Dependency pinning:** pin versions in `requirements.txt` to avoid surprises like the bcrypt/passlib issue recurring elsewhere
- **Theming discipline:** color tokens only change per theme — never layout/spacing/typography (see Section 10)

---

## 14. Design System — Direction & Theming

Design work was done collaboratively in Claude Design (claude.ai/design).

Direction is a "5c" style: dark base with a light mode available, geometric sans typography (Sora throughout — headings, body, and numerals), and a warm default accent, with 6 accent presets users can switch between. Layout, spacing, and typography stay fixed across themes — only color tokens change.

> Full design system (tokens, components, logo, brand guide) is maintained privately, not in this public repo.

---

## 15. Design System — Screens

Screens designed (mobile + web) so far: Login, Register, Onboarding, Home, Workout, Nutrition, Progress, Settings.

> Full design system (tokens, components, logo, brand guide) is maintained privately, not in this public repo.

---

## 16. Design System — AI Coach

A dedicated Coach screen/chat exists in the design, referenced contextually from Home. Not yet built on the backend — this is UI/UX design only. Actual LLM integration is Phase 4 (Section 11) and hasn't been started.

> Full design system (tokens, components, logo, brand guide) is maintained privately, not in this public repo.

---

## 17. Open Questions / Ideas (not committed yet)

- Should `injuries` and `equipment` in `user_profiles` be free-text, arrays, or their own related tables (more structured, more work upfront)?
- Should nutrition tracking use a food database API, or manual entry only, to start?
- What does "AI coach" mean concretely, technically — chat interface via an LLM API, wired to real logged data? (UI is designed; backend approach not decided)
- Should exercises come from a seeded reference table, or be entirely user-defined?
- When to introduce a migration tool (Alembic) — now, or once the schema stabilizes a bit more?
- Is a full test suite worth setting up now, or after the API surface is bigger?
- Which e1RM formula to use (Epley, Brzycki, etc.) — needs a decision before Progress charts can be built
- Where do daily nutrition targets (calories/macros) get set — onboarding, a settings screen, or calculated from profile data (goal/weight/activity)?
- Where does Profile live on mobile now that it's off the bottom nav?
- Exact icon set for nav items not finalized
- Empty states (no workouts logged yet, no food logged yet) not yet designed
- Error/loading states not yet designed

---

## 18. Glossary (for learning-as-I-go reference)

- **JWT (JSON Web Token):** A signed piece of data the server gives the client after login, proving who they are on future requests, without the server needing to store session state.
- **Dependency (FastAPI):** A function FastAPI runs automatically before your route logic, and injects its return value as an argument — used for things like auth checks.
- **bcrypt:** An algorithm for securely hashing passwords so raw passwords are never stored.
- **Docker Compose:** A tool for defining and running multiple linked containers (e.g. a database + an API) together via one config file.
- **Host port vs container port:** The container's internal port (e.g. 5432) vs the port exposed on the actual server machine (e.g. 5433) — they can differ, which is why you sometimes need to specify both.
- **Migration (database):** A version-controlled, repeatable script that changes your DB schema (e.g. adding a table/column), so schema changes can be tracked and applied consistently across environments instead of run manually and forgotten.
- **Pydantic model:** A Python class (used heavily by FastAPI) that defines the shape and validation rules of request/response data.
- **e1RM (estimated 1-rep max):** A calculated estimate of the maximum weight someone could lift for one rep, based on a formula applied to their actual logged reps/weight (e.g. 8 reps at 185 lb). Used to track strength progress over time without requiring an actual 1-rep max test every session.
