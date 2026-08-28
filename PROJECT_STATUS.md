# Gymind — Project Documentation

_Last updated: 2026-08-27_

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
| `accent_preset` | text, nullable | One of: Ember, Signal, Amber, Violet, Volt |
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

### `exercises` — ✅ built
Shared seeded reference exercises and private user-created exercises live in the same table, same pattern as `foods`.
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `name` | text | Not null |
| `muscle_group` | text | Not null — e.g. "chest", "back", "legs", "shoulders", "arms", "core" |
| `user_id` | int (FK → users.id), nullable | NULL = shared/seeded exercise; set = a private user-created exercise |

Seeded with ~37 common exercises across all six muscle groups via manual SQL (see Section 10).

### `workout_sets` — ✅ Built (models, schemas, and routes)
One row per logged set — see Section 10 for why sets aren't grouped/collapsed.
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `workout_id` | int (FK → user_workouts.id) | Parent workout session |
| `exercise_id` | int (FK → exercises.id) | Not null — which exercise this set was performed for |
| `set_number` | int | Not null — this set's position within the exercise |
| `weight` | float, nullable | |
| `reps` | int, nullable | |

Still open: session duration/target-weight display (see Section 17).

### `foods` — ✅ built
Shared USDA reference foods and private user-created foods live in the same table.
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `fdc_id` | int, nullable, unique | USDA FoodData Central id — NULL for user-created foods |
| `name` | text | Not null |
| `calories` | float, nullable | Per 100g |
| `protein` | float, nullable | Per 100g |
| `carbs` | float, nullable | Per 100g |
| `fat` | float, nullable | Per 100g |
| `user_id` | int (FK → users.id), nullable | NULL = shared USDA reference food; set = a private user-created food |

### `nutrition_logs` — ✅ built
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `user_id` | int (FK → users.id) | Not null |
| `food_id` | int (FK → foods.id) | Not null |
| `quantity_grams` | float | Not null |
| `logged_at` | timestamptz | Default now(), optionally overridable by the client to backdate an entry |

### `nutrition_targets` — ✅ built
One row per user — targets are calculated by default and can be manually overridden (see Section 10).
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `user_id` | int (FK → users.id) | Unique — one row per user |
| `target_calories` | float, nullable | |
| `target_protein` | float, nullable | |
| `target_carbs` | float, nullable | |
| `target_fat` | float, nullable | |
| `is_manual` | boolean | Not null, default `false` — `false` = recalculated from profile/bodyweight data; `true` = user-entered values, preserved until reset |
| `updated_at` | timestamptz | Default now(), updates on change |

### `body_weight_logs` — ✅ built
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `user_id` | int (FK → users.id) | Not null |
| `weight` | float | Not null |
| `unit` | text | Not null — `"lb"` or `"kg"` |
| `logged_at` | timestamptz | Default now(), optionally overridable by the client to backdate an entry |

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
| POST | `/exercises` | ✅ Built | Creates a user-owned custom exercise (`name` + `muscle_group`). Uses `require_profile`. |
| GET | `/exercises` | ✅ Built | Search by name (`?search=`). Returns shared/seeded exercises (`user_id IS NULL`) OR the current user's own, same filter pattern as `/foods`. Uses `require_profile`. |
| POST | `/workouts` | ✅ Built | Creates a new workout session for the current user. Uses `require_profile`. |
| GET | `/workouts` | ✅ Built | Lists workout sessions for the current user. Uses `require_profile`. |
| PUT | `/workouts/{id}` | ✅ Built | Marks a workout session finished by setting `ended_at`. Uses `require_profile`; checks `user_id` ownership before modifying. |
| POST | `/workouts/{id}/sets` | ✅ Built | Logs a set against a workout session (`exercise_id`, not free-text). Validates `exercise_id` exists, `404` if not. Uses `require_profile`; checks `user_id` ownership before modifying. Returns the set with a nested `exercise` object (name + muscle_group), not just the raw id. |
| GET | `/workouts/{id}` | ✅ Built | Workout detail with nested `sets`, each with a nested `exercise` object (name + muscle_group), not just `exercise_id`. Uses `require_profile`; checks `user_id` ownership before returning. |
| DELETE | `/workouts/{id}` | ✅ Built | Deletes a workout. Uses `require_profile`; checks `user_id` ownership before deleting. Cascade-deletes its sets via `ON DELETE CASCADE` on `workout_sets.workout_id`. |

### Nutrition
| Method | Path | Status | Description |
|---|---|---|---|
| POST | `/foods` | ✅ Built | Creates a user-owned custom food. Uses `require_profile`. |
| GET | `/foods` | ✅ Built | Search by name (`?search=`). Returns shared USDA foods (`user_id IS NULL`) OR the current user's own foods. Uses `require_profile`. |
| POST | `/nutrition` | ✅ Built | Logs a meal (`food_id` + `quantity_grams`, optional `logged_at`). Validates `food_id` exists first, `404` if not. Uses `require_profile`. Returns the log with a nested `food` object (name/calories/protein/carbs/fat), not just `food_id`. |
| GET | `/nutrition` | ✅ Built | Lists the current user's own logs, optional `?search=` by food name. Uses `require_profile`. Each log includes a nested `food` object (name/calories/protein/carbs/fat), not just `food_id` — joins `NutritionLog`+`Food` in one query, no N+1. |
| PUT | `/nutrition/{id}` | ✅ Built | Edits a log. Ownership-checked (`404` if not found or not theirs), re-validates `food_id`. Uses `require_profile`. Returns the log with a nested `food` object, same as POST/GET. |
| DELETE | `/nutrition/{id}` | ✅ Built | Deletes a log. Same ownership check as PUT. Uses `require_profile`. |
| GET | `/nutrition/summary` | ✅ Built | Aggregated totals (calories/protein/carbs/fat) across the user's logs. Joins `NutritionLog`+`Food` in one query. Uses `require_profile`. |
| GET | `/nutrition/targets` | ✅ Built | Returns the current user's daily calorie/macro targets. If no row exists yet, calculates fresh values from profile/bodyweight data and creates it with `is_manual=false`. Uses `require_profile`. |
| PUT | `/nutrition/targets` | ✅ Built | Manually sets `target_calories`/`target_protein`/`target_carbs`/`target_fat`; sets `is_manual=true` so `GET` stops recalculating. Uses `require_profile`. |
| POST | `/nutrition/targets/reset` | ✅ Built | Resets `is_manual` back to `false` and recalculates targets fresh from current profile/bodyweight data. Uses `require_profile`. |

### Body Weight
| Method | Path | Status | Description |
|---|---|---|---|
| POST | `/body-weight` | ✅ Built | Creates a body weight log entry (`weight`, `unit`, optional `logged_at`). Uses `require_profile`. |
| GET | `/body-weight` | ✅ Built | Lists the current user's own logs, ordered by `logged_at` descending. Uses `require_profile`. |
| PUT | `/body-weight/{id}` | ✅ Built | Edits a log. Ownership-checked (`404` if not found or not theirs). Uses `require_profile`. |
| DELETE | `/body-weight/{id}` | ✅ Built | Deletes a log. Same ownership check as PUT. Uses `require_profile`. |

### Progress
Four focused read-only aggregation endpoints rather than one mega-route, matching the rest of the API's style (see `/nutrition/summary`, `/nutrition/targets`). All scoped to the current user only, all use `require_profile`.
| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/progress/body-weight` | ✅ Built | Body weight trend, oldest → newest. Optional `?days=` to limit to a trailing window. Normalizes mixed lb/kg entries to a single unit (the most recent log's unit) so the trend never silently mixes units. |
| GET | `/progress/e1rm` | ✅ Built | e1RM trend for one exercise (`?exercise_id=`, required), oldest → newest. e1RM calculated on read via the Epley formula, one entry per logged set. |
| GET | `/progress/muscle-groups` | ✅ Built | Muscle-group strength summary — best (highest) e1RM per muscle group across all its exercises, one grouped SQL query. |
| GET | `/progress/consistency` | ✅ Built | "X of Y days trained" over a trailing window (`?days=`, default 28) — distinct days with at least one finished (`ended_at` set) workout session. |

### Planned
| Method | Path | Status | Description |
|---|---|---|---|
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
- **Rate limiting on auth routes:** added `slowapi`, with a `Limiter` keyed by client IP. Applied to `POST /auth/login` and `POST /auth/register`, 5 requests/minute each, returning `429` with a clear message when the limit is hit. **Gotcha:** after adding `slowapi` to `requirements.txt`, a normal `docker compose up -d --build` did not actually install the new dependency in the running container — a cache-busting rebuild (`docker compose build --no-cache`) was required to pick it up. Worth remembering for future dependency additions.
- **`.gitignore` hardened:** broadened from specific known filenames to pattern-based exclusions (`*.env`, `token.txt`, `*_secret*`, `*credentials*`, `*_test.json`, `test_*.json`) as a safety net against future accidental commits of scratch/secret files, not just files remembered to name individually.
- **`workout_sets.workout_id` uses `ON DELETE CASCADE`** — deleting a `user_workouts` row automatically deletes its associated `workout_sets` rows at the database level. Verified via `pg_constraint` (`confdeltype = 'c'`). No manual cleanup needed in the `DELETE /workouts/{id}` route.
- **Local uvicorn invocation:** since `main.py` lives inside `backend/app/`, not `backend/` directly, run `python -m uvicorn app.main:app --reload` from `backend/` — not `uvicorn main:app`.
- **Shared vs. private foods, one table:** USDA reference foods and user-created foods both live in `foods`. Privacy is enforced entirely by the query filter (`or_(Food.user_id.is_(None), Food.user_id == current_user.id)`), not by separate tables. Any route that queries `Food` without this filter would leak other users' private foods.
- **`datetime.now()` as a Pydantic field default is a trap:** used as a class-level default (`field: datetime = datetime.now()`), it evaluates once at class-definition/import time, not per-request — every request would get the same stale timestamp. Fixed by defaulting the field to `Optional[datetime] = None` and resolving `field or datetime.now()` inside the route body instead, so it's evaluated fresh on each request.
- **N+1 fix in `GET /nutrition/summary`:** originally risked querying `Food` once per `NutritionLog` in a loop. Fixed with a single `db.query(NutritionLog, Food).join(Food, NutritionLog.food_id == Food.id)` query, then summing in Python.
- **`Base.metadata.create_all()` discovered and removed:** present since the second commit ever (`e6f06a8`, before any real routes existed), it ran unconditionally on every app import/startup — no environment gate. Investigation found it had silently created 5 tables (`users`, `user_workouts`, `workout_sets`, `body_weight_logs`, `nutrition_targets`) alongside the documented "manual psql only" policy, identifiable by SQLAlchemy's auto-named indexes/constraints (e.g. `ix_users_id`) that a human wouldn't hand-write. No functional schema drift was found — columns, types, and foreign keys all matched what's documented — only cosmetic differences (`varchar` vs. documented `text` on `users`, auto-generated index names). The call has been removed from `main.py`; the schema now has exactly one source of truth (manual psql DDL) going forward.
- **`workout_sets.exercise_name` → `exercise_id` migration:** done entirely by hand via psql, in the order the "manual SQL only" policy requires: add `exercise_id` as a nullable column → backfill every existing row → set it `NOT NULL` → drop the old `exercise_name` column. No migration tool involved.
- **e1RM computed on read, never stored (Epley: `weight * (1 + reps / 30)`):** chosen over storing/recomputing-on-write because there's no user-override case for e1RM the way there is for calorie targets — it's a pure function of `weight`/`reps` that already exist on `workout_sets`. Computing on read also means changing the formula later needs no backfill of historical data.
- **Daily nutrition targets: calculate-by-default, manual-override pattern:** `nutrition_targets.is_manual` — `false` means the row is recalculated from profile/bodyweight data on read; `true` means the user's own entered values are preserved until they explicitly call `POST /nutrition/targets/reset`. Same shape as any "smart default the user can override" setting.
- **Testing infrastructure:** `conftest.py` overrides the app's `get_db` dependency to point at a separate `gymind_test` database rather than the real dev DB. Each test gets a clean schema (`create_all()` before, `drop_all()` after) rather than transaction rollback, since routes call `db.commit()` themselves. A rate-limiter-reset autouse fixture is required in any test file that calls `/auth/register` or `/auth/login` more than once per test run, since `slowapi`'s rate limit state lives on the shared `app` object and isn't reset between tests by default — not an app bug, the rate limiting itself is correct, documented, working behavior; this is purely a test-isolation fix.
- **Alembic autogenerate caught a real model/DB mismatch:** the first autogenerated migration revealed that `workout_sets.workout_id`'s `ForeignKey` declaration in `models.py` is missing `ondelete="CASCADE"`, even though the real database has that cascade behavior (set up manually via psql, verified earlier via `pg_constraint`). Autogenerate will keep proposing to drop this cascade until the model is updated to match the database. Flagged as a known open item — not yet fixed, since fixing it wasn't in scope for the baseline setup task. See Section 17.

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
- [x] **Workouts**
  - [x] Design `workouts`, `exercises`, and `workout_sets` tables (or similar normalized structure) — **implemented as a two-table design: `user_workouts` for sessions, `workout_sets` for individual sets, normalized so each set is its own row for the Progress screen's e1RM chart (Section 15). See Section 8.**
  - [x] `POST /workouts` — create a workout session
  - [x] `GET /workouts` — list past workouts for current user
  - [x] `PUT /workouts/{id}` — implemented as finish-a-session (sets `ended_at`), not a general edit route — a broader edit endpoint may still be needed later
  - [x] `POST /workouts/{id}/sets` — log a set against a workout session
  - [x] `GET /workouts/{id}` — workout detail with nested sets
  - [x] Fixed: `POST /workouts/{id}/sets` no longer allows logging sets on a finished workout — `409` guard on `ended_at`, tested end-to-end, deployed. See Section 10.
  - [x] `DELETE /workouts/{id}` — delete (cascade-deletes associated workout_sets via ON DELETE CASCADE)
  - [x] Decide on exercise list source: user-defined only, or a seeded reference table of common exercises? — **decided: seeded reference table (`exercises`, ~37 common exercises) plus user-added custom exercises, both muscle-group tagged, same shared/private pattern as `foods`. See Section 8/10.**
  - [x] Decide on e1RM formula (e.g. Epley) and whether it's computed on write or on read — **decided: Epley formula, computed on read, never stored. See Section 10.**
- [x] **Nutrition**
  - [x] Design `foods` and `nutrition_logs` schema — see Section 8
  - [x] Decide: manual macro entry vs. food database API lookup — **decided: USDA SR Legacy import for shared reference foods, plus manual user-created foods in the same `foods` table (see Section 10)**
  - [x] CRUD endpoints — `POST/GET /foods`, `POST/GET /nutrition`, `PUT/DELETE /nutrition/{id}`, `GET /nutrition/summary`, all built and tested. See Section 9.
  - [x] Decide where daily calorie/macro targets live (per-user setting) — **decided: own table (`nutrition_targets`), calculate-by-default with manual override via `is_manual`. See Section 8/10.**
- [x] **Body weight tracking**
  - [x] Design `body_weight_logs` schema — see Section 8
  - [x] CRUD endpoints — `POST/GET/PUT/DELETE /body-weight`, all built. See Section 9.
- [x] **Progress**
  - [x] Design aggregation queries: body weight trend, e1RM trend per exercise, muscle-group strength summary, simple consistency count
  - [x] `GET /progress` endpoint(s) returning this data, shaped for the charts already designed — **built as 4 focused endpoints (`/progress/body-weight`, `/progress/e1rm`, `/progress/muscle-groups`, `/progress/consistency`) rather than one route. See Section 9.**

### Phase 3 — Mobile App
- [x] Full visual design complete for all 8 core screens + AI Coach chat, mobile and web (Sections 14–16)
- [ ] Scaffold React Native + React Native Web project in `/mobile`
- [ ] Set up shared navigation (React Navigation or similar) — nav structure already decided: Home, Coach, Workout, Nutrition, Progress, Settings
- [ ] Implement theme system as a single context/provider (dark/light + 5 accent presets), matching the token contract in Section 14
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
- [x] Add at least minimal tests for auth endpoints before building more on top — done, and expanded beyond auth to cover ownership and key business logic (17 tests total). See Section 13.
- [x] Decide on a migration tool (e.g. Alembic) before the schema grows much further, so schema changes are tracked rather than manual — decided and set up: Alembic, baselined via `stamp head`. See Section 10/13.

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
- **Testing:** a real `pytest` suite exists — 17 tests across `tests/test_auth.py`, `tests/test_workouts.py`, and `tests/test_nutrition_targets.py`, covering auth boundaries (invalid/missing tokens, duplicate registration, `require_profile` gating), ownership checks (can't access another user's workout), and key business logic (the finished-workout `409` guard, the `nutrition_targets` `is_manual` override/reset behavior). Uses FastAPI's `TestClient` against a separate `gymind_test` Postgres database, not the real dev DB. Run with `python -m pytest -v` from `backend/`.
- **Migrations:** Alembic is now set up. The existing schema was baselined via `alembic stamp head` — this marks the current schema as Alembic's starting point without executing any SQL against it, since the schema already existed from manual psql work. Going forward, schema changes follow the real Alembic loop: edit `models.py` → `alembic revision --autogenerate -m "..."` → review the generated migration file carefully → `alembic upgrade head`.
- **Dependency pinning:** pin versions in `requirements.txt` to avoid surprises like the bcrypt/passlib issue recurring elsewhere
- **Theming discipline:** color tokens only change per theme — never layout/spacing/typography (see Section 10)
- **Rate limiting:** auth routes are rate-limited (5/min per IP) as of 2026-08-25 (see Section 10) — extend this pattern to other write-heavy routes if abuse becomes a concern.

---

## 14. Design System — Direction & Theming

Design work was done collaboratively in Claude Design (claude.ai/design).

Direction is a "5c" style: dark base with a light mode available, geometric sans typography (Sora throughout — headings, body, and numerals), and a warm default accent, with 5 accent presets users can switch between. Layout, spacing, and typography stay fixed across themes — only color tokens change.

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
- Where does Profile live on mobile now that it's off the bottom nav?
- Exact icon set for nav items not finalized
- Empty states (no workouts logged yet, no food logged yet) not yet designed
- Error/loading states not yet designed
- `workout_sets.workout_id`'s `ForeignKey` in `models.py` is missing `ondelete='CASCADE'`, even though the real DB has it — needs a model fix so Alembic autogenerate stops flagging it as drift (see Section 10)

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
