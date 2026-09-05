# Gymind — Project Documentation

_Last updated: 2026-09-05_

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
| Mobile / Web | Expo (TypeScript + Expo Router, SDK 57) | Phase 3 underway — project scaffolded in `/mobile`, navigation skeleton done (6 tabs + auth/onboarding routes outside the tab group), all confirmed working |
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
├── backend/               # FastAPI app — complete (Section 8-9)
├── mobile/                # Expo/React Native app — Phase 3 underway, Workout screen is current focus
├── Design/
│   ├── exports/           # "5c" era screen images — superseded by Brand 2.0 (Section 14), pending archive
│   │   ├── mobile/        # 9 mobile screens
│   │   ├── web/           # 9 web screens
│   │   ├── base-token-reference.png
│   │   └── theming-comparison-grid.png
│   ├── Source/            # "5c" era Claude Design source files (.dc, support.js) — superseded
│   └── (Brand 2.0 handoff not yet added — see Phase 3.5 in Section 11: BRAND_GUIDE.md, README.md,
│         PUBLISHING_CHECKLIST.md, Gymind UI.dc.html, logo-mark.png, app-icon-1024.png, splash-screen.png)
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

**Pre-commit hooks don't sync via git:** the `gitleaks` secret-scanning hook (`.pre-commit-config.yaml`) only runs locally once `pre-commit install` has been run on that machine — it writes into `.git/hooks/`, which lives outside the repo and is never pushed or pulled. Pulling this change on MSI (or any new clone) gets you the config file, not an active hook. Before it's actually protecting a commit on a given machine, run there:
```
pip install pre-commit
pre-commit install
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
| `accent_preset` | text, nullable | One of: Ember, Signal, Amber, Violet, Volt. **Decided 2026-09-05: being retired as part of the Brand 2.0 migration (Section 14) — the new design uses a single fixed teal+gold palette, no user-selectable accent presets. Column removal is an open migration task, see Section 11's Brand 2.0 phase.** |
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

### `user_favorite_exercises` — ✅ built (previously undocumented)
Lets a user star exercises for quick access from the workout screen's exercise picker.
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `user_id` | int (FK → users.id, `ON DELETE CASCADE`) | Not null |
| `exercise_id` | int (FK → exercises.id, `ON DELETE CASCADE`) | Not null |
| `created_at` | timestamptz | Default now() |

Unique constraint on `(user_id, exercise_id)` — can't favorite the same exercise twice.

### `workout_exercise_notes` — ✅ built (previously undocumented)
Free-text note per exercise per workout session (the "+ Add note" feature on the workout screen).
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `workout_id` | int (FK → user_workouts.id) | Not null |
| `exercise_id` | int (FK → exercises.id) | Not null |
| `note` | text | Not null |
| `updated_at` | timestamptz | Default now(), updates on change |

Unique constraint on `(workout_id, exercise_id)` — one note per exercise per session, upserted.

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
| POST | `/auth/register` | ✅ Built | Creates a user, hashes password with bcrypt. **As of 2026-08-28, returns an access token immediately** (`schemas.UserWithToken`, extending `UserResponse` with `access_token`+`token_type`), reusing the existing `auth.create_access_token` function — not reimplemented. Frontend no longer needs a separate login call right after signup. |
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
| GET | `/exercises` | ✅ Built | Search by name, prefix match (`?search=`). **Also supports `?muscle_group=` (exact filter) and `?favorites_only=true`** (previously undocumented). Returns shared/seeded exercises (`user_id IS NULL`) OR the current user's own, same filter pattern as `/foods`. Each result includes `is_favorited` (bool) via an outer join against `user_favorite_exercises` for the current user. Uses `require_profile`. |
| POST | `/exercises/{id}/favorite` | ✅ Built (previously undocumented) | Favorites an exercise for the current user. `404` if the exercise doesn't exist, `409` if already favorited. Uses `require_profile`. |
| DELETE | `/exercises/{id}/favorite` | ✅ Built (previously undocumented) | Unfavorites an exercise. `404` if not currently favorited. Uses `require_profile`. |
| GET | `/exercises/{id}/history` | ✅ Built (previously undocumented) | **This is the workout screen's Prev/Tgt data source** — previously tracked as the biggest remaining gap; it's already built and wired into the frontend. Finds the current user's most recently *finished* workout (before today) containing this exercise, returns its sets (`previous_sets`) plus a `suggested_target_weight` (highest previous set's weight + 5). Returns empty/`null` if no prior history. Uses `require_profile`. |
| POST | `/workouts` | ✅ Built | Creates a new workout session for the current user. Uses `require_profile`. |
| GET | `/workouts` | ✅ Built | Lists workout sessions for the current user. Uses `require_profile`. **Fixed 2026-09-05:** `UserWorkoutOut` never declared `started_at`, so it was silently stripped from every entry in the list response (present in the DB, just not on the response model) — the mobile Past Workouts list showed "Invalid Date" for every entry as a result. Added `started_at: datetime` to `UserWorkoutOut`, matching `UserWorkoutDetail`. Verified via the pytest suite (27 passed) and a direct hit against a local dev server. |
| PUT | `/workouts/{id}` | ✅ Built | Marks a workout session finished by setting `ended_at`. Uses `require_profile`; checks `user_id` ownership before modifying. |
| POST | `/workouts/{id}/sets` | ✅ Built | Logs a set against a workout session (`exercise_id`, not free-text). Validates `exercise_id` exists, `404` if not. `409` if the workout is already finished. Uses `require_profile`; checks `user_id` ownership before modifying. Returns the set with a nested `exercise` object (name + muscle_group), not just the raw id. |
| GET | `/workouts/{id}` | ✅ Built | Workout detail with nested `sets`, each with a nested `exercise` object (name + muscle_group + that exercise's note for this session, if any). Uses `require_profile`; checks `user_id` ownership before returning. |
| PUT | `/workouts/{id}/exercises/{exercise_id}/note` | ✅ Built (previously undocumented) | Upserts a free-text note for one exercise within one workout session (unique on `workout_id`+`exercise_id`). Uses `require_profile`; checks workout ownership and that the exercise exists. |
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
- **`/auth/register` now returns a token immediately (2026-08-28):** previously returned only the created user (`UserResponse`), requiring a separate `/auth/login` call to get a JWT. Now returns `schemas.UserWithToken` — `UserResponse`'s fields plus `access_token`/`token_type` — built by calling the same `auth.create_access_token` function `/auth/login` already uses, not a duplicate implementation. `/auth/login`'s own behavior is unchanged. Lets the frontend skip a redundant login step right after signup.
- **Frontend theme system — rewritten for Brand 2.0 (2026-09-05):** `mobile/src/constants/theme.ts` + `mobile/src/context/ThemeContext.tsx` no longer use the old 5-preset accent system (Ember/Signal/Amber/Violet/Volt). `ThemeProvider`/`useTheme` now expose `brand2Base` (dark/light bg/card/text tokens), `getBrandTokens(mode)` (fixed `teal`/`gold`/`coral` plus derived `tealSoft`/`goldSoft`/`coralSoft` and `tealOn`/`goldOn`/`coralOn`), `statusColors`, `shapeTokens` (cut-corner presets), `motionTokens` (timing presets), and `setCircleBase` (shared set-row circle style). Consumed by screens as `const { colors } = useTheme()`, same as before. **Known gaps:** `colors.gold`/`goldSoft`/`goldOn` aren't referenced anywhere yet (no Coach/Nutrition screens exist to use them); `shapeTokens` is exposed via context but no screen consumes it yet — the cut-corner shape language from Section 14 hasn't actually been applied to any built screen.
- **`colors.accent` → `colors.teal` / `colors.soft` → `colors.tealSoft` renamed across all built screens** (Login, Register, Onboarding, the root redirect screen, Workout) — pure token rename, no layout/behavior change. `colors.on` was renamed to `colors.tealOn`/`colors.coralOn` only where it was touched as part of other Workout-screen work; a handful of `colors.on` references may still remain elsewhere and should be swept in a follow-up pass.
- **Workout screen partially componentized (2026-09-05):** 7 new shared components added under `mobile/src/components/` — `Button` (primary/danger/secondary, sm/lg), `ConfirmModal` (generic confirm/cancel modal), `StatCard` (single stat tile), `ExerciseCardCollapsed`, `PlannedSetRow`, `LoggedSetRow`, `EditableSetRow` (the 3 set-row variants). All wired into `workout.tsx`, same visual output/behavior as the inline JSX they replaced. **`Button` is only used inside `workout.tsx` so far** (8 of its Pressables) — Login/Register/Onboarding still use raw `Pressable` for their buttons and haven't been converted. Note-editor Save/Cancel and the muscle-group filter chips in `workout.tsx` were deliberately left as inline `Pressable`s (non-standard sizing / chip styling, not a fit for `Button` as built).
- **Register/Login screens are functionally complete and now visually styled** to match `Design/exports/mobile/mobile-login.png`/`mobile-register.png` (see Section 11, Section 17 for a few intentional deviations from the design). Login (`mobile/src/app/login.tsx`): `POST /auth/login`, saves the returned JWT to `AsyncStorage`, handles both bad-credentials (non-2xx response) and network failures (fetch throwing). Register (`mobile/src/app/register.tsx`): `POST /auth/register`, client-side password validation (8+ characters, at least one uppercase letter) and a password-confirmation check, all run before the request fires.
- **Onboarding-gate redirect flow on the frontend (`mobile/src/app/checkOnboarding.tsx`):** after any successful login or registration, the app routes through this screen, which calls `GET /users/onboarding-check` with the saved token and redirects to Home on `200` or Onboarding on `403`. Confirmed working both for a fresh registration (no profile yet → Onboarding) and a later login with an incomplete profile (also → Onboarding).
- **SVG support added for real logo/icon assets:** `react-native-svg` + `react-native-svg-transformer`, configured in `mobile/metro.config.js` (`babelTransformerPath` pointed at `react-native-svg-transformer/expo`, matching that library's documented setup for Expo SDK v41+; the bare package root also works here since it auto-detects Expo's babel transformer, but `/expo` was picked to match upstream docs exactly). The real logo mark lives at `mobile/src/assets/mark.svg`, chosen over `mark-light.svg`/`mark-mono.svg` specifically because it's tuned for the app's default dark theme (its low-opacity accent strokes are white, meant to read against a dark background — `mark-light.svg` uses dark strokes for a light background instead).
- **Gotcha: a `metro.config.js` change needs `npx expo start -c`, not a plain restart.** Metro caches per-file transform output; a plain restart/hot-reload can keep serving the *pre-transformer* output for files that were already cached before the config changed. Hit this exactly once: after adding the SVG transformer, `import Mark from "./mark.svg"` kept resolving to a plain asset object instead of a component, throwing "Element type is invalid: expected a string... but got: object" — which looks like a transformer/config bug but isn't. A full cache-cleared restart (`npx expo start -c`) fixed it immediately; verified by inspecting the compiled bundle output before and after.
- **Workout screen (`mobile/src/app/(tabs)/workout.tsx`) session header uses three-state logic**, not a single boolean: `SESSION LIVE` / `SESSION PAUSED` / `NOT STARTED`, driven by two separate pieces of state — `isRunning` (boolean) and `elapsedSeconds` (numeric timer) — rather than collapsing to one "started" flag. Matches the design's distinct visual treatment for each state.
- **Workout screen stat cards (Volume, Sets, Best e1RM)** are computed via a single `stats` `useMemo` hook rather than three separate calculations, recalculating only when the underlying set data changes. Best e1RM reuses the same Epley formula already established on the backend (Section 10, above, and `/progress/e1rm`) rather than reimplementing it on the frontend.
- **Collapsed exercise cards on the workout screen use three visual states** — `QUEUED` / `IN PROGRESS` / `COMPLETED` — with a checkmark badge shown only once every set in that exercise is marked complete.
- **8 dead Expo Router scaffold files removed** from `/mobile` (leftover from the initial `create-expo-app` scaffolding, never referenced anywhere in the app). Confirmed zero references to each file before deleting, then verified a clean `tsc --noEmit` afterward with no new errors.

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
  - [x] Implement the frontend half of the gate — `checkOnboarding.tsx` calls `GET /users/onboarding-check` after login/register and redirects to Home or Onboarding accordingly. Confirmed working for both a fresh registration and a later login with an incomplete profile. See Section 10.

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
  - [ ] Migrate mobile exercise name entry from free-text TextInput to the existing `exercises` table via a picker/autocomplete UI (`GET /exercises`), before building Progress screen (see Section 17 for full rationale)
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
- [x] Scaffold React Native project in `/mobile` — **decided: Expo (TypeScript + Expo Router), SDK 57**, not a bare React Native + React Native Web setup
- [x] Set up shared navigation — nav skeleton built with Expo Router: 6 tabs (Home, Coach, Workout, Nutrition, Progress, Settings) plus login/register/onboarding routes outside the tab group, all confirmed working
- [x] Implement theme system as a single context/provider (dark/light + 5 accent presets), matching the token contract in Section 14 — `mobile/src/constants/theme.ts` + `mobile/src/context/ThemeContext.tsx`. See Section 10.
- [x] Build register/login screens wired to `/auth/*` — functionally complete (real backend calls, JWT storage, validation, error handling), **and now visually styled** to match `Design/exports/mobile/mobile-login.png` and `mobile-register.png` (previously functional but unstyled). See Section 10, Section 17 for a few intentional deviations from the design.
- [x] Build post-login/register redirect logic based on `GET /users/onboarding-check` — `checkOnboarding.tsx`, confirmed working. See Section 10.
- [x] Build the actual onboarding form wired to `/users/profile` — full 5-step wizard (goal, experience level, injuries, equipment, dietary restrictions), single-select cards, multi-select chips, free-text field, progress bar, real `POST /users/profile` with the auth token, redirects to Home on success.
- [ ] Visual design pass for Onboarding to match the real screens in `Design/exports/` — Login and Register are now styled (above); Onboarding is still functional but visually unstyled
- [ ] **Build core workout logging UI** — far along, more complete than previously documented. Done: session header with three-state logic (`SESSION LIVE` / `SESSION PAUSED` / `NOT STARTED`, driven by `isRunning` + `elapsedSeconds`); Volume/Sets/Best e1RM stat cards via a `stats` `useMemo` hook (Epley formula for e1RM); three-state collapsed exercise card styling (`QUEUED` / `IN PROGRESS` / `COMPLETED` with a checkmark badge); exercise picker wired to `GET /exercises` (search + muscle-group filter + favorites); exercise favoriting; per-set PREV/TGT display via `GET /exercises/{id}/history`; per-exercise notes via `PUT /workouts/{id}/exercises/{exercise_id}/note`; Past Workouts modal with per-workout delete; Finish Workout confirm modal + session summary. Still open: rest timer, "Finish session" secondary options menu, "Repeat this workout" from Past Workouts, per-workout totals in the Past Workouts list, editing already-logged past sets (no `PUT /workouts/{id}/sets/{set_id}` route yet) — see Section 17.
- [ ] Build Home screen (streak strip, AI Coach card, Nutrition card, Workout card)
- [ ] Build Progress screen with drillable muscle-group → exercise → e1RM chart
- [ ] Decide on state management approach (Context API vs. something like Zustand/Redux) once the app has enough shared state to justify it
- [ ] Design still open: empty states, loading/error states, exact icon set, where Profile lives now it's off the bottom nav (see Section 17)

### Phase 3.5 — Brand 2.0 Visual Migration (new, 2026-09-05)
Full migration from the old "5c" direction to the new Brand 2.0 system (Section 14-16). Decided: this is a full migration, not a partial reskin — `accent_preset` is being retired, not kept dormant.
- [ ] Add the new handoff files to the repo (`Design/` — currently only on this machine, not committed): `BRAND_GUIDE.md`, `README.md`, `PUBLISHING_CHECKLIST.md`, `Gymind UI.dc.html`, `logo-mark.png`, `app-icon-1024.png`, `splash-screen.png`. Old `Design/exports/` and `Design/Source/` (the "5c" assets) should be archived/marked superseded, not deleted outright, in case anything needs to be referenced during migration.
- [x] Rewrite `mobile/src/constants/theme.ts` + `mobile/src/context/ThemeContext.tsx`: new fixed teal/gold/coral token set (`brand2Base`, `getBrandTokens`, `shapeTokens`, `motionTokens`, `setCircleBase`), 5-preset accent system fully removed. See Section 10.
- [ ] Backend: Alembic migration to drop `user_preferences.accent_preset`; remove the field from `schemas.py`/`profile_routes.py` — **still pending**, column and schema field both still present (verified 2026-09-05).
- [x] Color tokens renamed across Login/Register/Onboarding/root-redirect/Workout (`colors.accent`→`colors.teal`, `colors.soft`→`colors.tealSoft`) — **but this is only the token rename, not the actual re-skin.** Still open: applying the new shape language (cut-corner containers, `shapeTokens`) and full visual re-check against the intentional-deviations list (Section 17) for Login/Register; Onboarding is still visually unstyled beyond the token rename.
- [ ] Style Onboarding for the first time (currently functional, colors renamed to Brand 2.0 tokens, but not yet built to the actual Brand 2.0 shape/layout spec)
- [ ] Re-skin Workout screen: swap Ember left-edge-border cards for cut-corner containers + teal/gold. **Partial progress:** color tokens renamed (teal) and UI componentized into 7 shared components (Button, ConfirmModal, StatCard, ExerciseCardCollapsed, PlannedSetRow, LoggedSetRow, EditableSetRow — see Section 10) as groundwork, but the actual cut-corner shape treatment (`shapeTokens`) has not been applied to any card/container yet — still visually the old rounded-rect style. All existing logic (session state, stats, exercise states, PREV/TGT, notes, favoriting) untouched throughout.
- [ ] Build Home, Nutrition, Progress, Coach directly in Brand 2.0 (no old-design version of these ever existed, so no double work)
- [ ] Backend: `nutrition_logs.photo_url` column + upload endpoint/storage for meal photos; a `progress_photos` table + endpoint for progress-photo strip (both currently UI-only in the new design)
- [ ] Decide photo storage approach (local volume on the home server vs. an object-storage service) before building the above — affects both endpoints
- [ ] Adopt a production icon set (Lucide or Phosphor) to replace the prototype's hand-drawn placeholder icons — not yet decided
- [ ] Wire `app-icon-1024.png` via `app.json`'s `"icon"` field; configure real splash via `expo-splash-screen`/`app.json`'s `"splash"` using the brand dark base + logo mark only (not the full animated-blob scene from `splash-screen.png`); split the icon into `foreground`/`background` layers for Android's adaptive icon spec
- [ ] After the mobile migration is done: **begin the web version** (React Native Web target), per plan

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

## 14. Design System — Direction & Theming ("Brand 2.0" — supersedes "5c")

**As of 2026-09-05, the entire visual direction is being replaced.** The original "5c" direction (Sora typeface, Ember-orange default with 5 switchable accent presets, standard rounded cards, Ember left-edge-border accent on active cards) is superseded by a new brand system, built collaboratively in Claude Design and handed off as `BRAND_GUIDE.md` + `README.md` + `PUBLISHING_CHECKLIST.md` + a live interactive prototype (`Gymind UI.dc.html`) plus exported logo/icon/splash assets. None of these new handoff files are in the repo yet — see the Brand 2.0 migration checklist in Section 11 for getting them in.

**Name & positioning:** Gymind — fitness tracking with a mind: workouts, nutrition, body progress, and an AI coach in one account. Tone: encouraging, direct, competent — a knowledgeable training partner, not a hype-man. Numbers carry the energy ("5-day streak", "365 lb best e1RM"), not exclamation marks.

**Color — two accent hues on a neutral dark/light base, never a third:**
| Role | Usage |
|---|---|
| Base / Surface / Ink / Ink dim | Screens, cards, primary/secondary text — neutral, same hue family (~228) in both themes |
| **Teal** (primary) | Primary actions, progress, focus, calorie/e1RM rings |
| **Gold** (secondary) | Coach/energy accents, macro highlights |
| **Coral** (alert only) | Rest timer, destructive actions — never decorative |

All colors are defined in OKLCH (exact values in `BRAND_GUIDE.md`/`README.md`, not duplicated here since this doc stays public). Pure orange and high-chroma "electric" blue are explicitly avoided as generic/AI-tool-coded.

**Typography:** Space Grotesk (600/700 — headings, screen titles, large numerals) + Manrope (400-800 — everything else). Sora is retired. Never a third typeface.

**Shape language — the one signature change:** an asymmetric "cut corner" (large radius top-left & bottom-right, small radius on the other two corners) on containers — hero/feature cards, the logo mark, corner accent marks. Tap targets (buttons, chips, inputs, avatars, dots) stay fully rounded (pill/circle) for contrast. Bottom sheets are flat-bottomed; centered modals are uniform rounded rects. **The old Ember left-edge-border "AI dashboard" card style is now an explicit anti-pattern** — don't carry it into any re-skinned screen, including the already-built Workout screen.

**Accent motif:** a small rotated square ("diamond"), used as a corner mark on hero cards and as the active-tab indicator in the nav bar.

**Theming:** dark/light toggle stays, same as before — only color tokens change, never layout/spacing/typography. The **5-accent-preset system is retired** in favor of this single fixed teal+gold+coral palette (see Section 8's `accent_preset` note — DB column removal is a Brand 2.0 migration task).

**Iconography:** no icon library used in the design prototype (hand-drawn simple geometric shapes, to avoid a generic "AI slop" look) — production should adopt a single simple/geometric set (Lucide or Phosphor suggested, regular weight, no filled/glossy/3D styles). **Not yet decided which.**

**Motion:** screens/tabs rise-and-fade in (`screenIn`, ~400-450ms); sheets slide up, modals pop from center (never the same motion for both); progress rings/bars/timers always animate smoothly (500-600ms), never jump; 3 ambient background gradient blobs drift slowly and decoratively (16-22s loops), never blocking touches. In React Native, targets Reanimated's `withTiming`/keyframe-equivalent APIs.

**Brand mark:** cut-corner square filled with the teal→gold gradient, containing a white pulse/heartbeat zig-zag line (evokes a workout heart-rate readout, not a literal heart icon). Exported assets ready to drop into `app.json`: `logo-mark.png` (256×256), `app-icon-1024.png` (1024×1024, no transparency — App Store/Play Store spec), `splash-screen.png` (1170×2532, a **visual reference for splash config, not a literal drop-in asset** — the real native splash should be the mark on a flat dark surface per platform convention, not the full ambient-blob scene).

> Full design system detail (exact OKLCH values, component specs, brand guide) lives in the handoff files under `Design/` once added to the repo (Section 11) — this section stays a high-level summary, consistent with how the old "5c" system was documented.

---

## 15. Design System — Screens

Full visual redesign (Brand 2.0) covers: Login, Register, Onboarding (5-step wizard), Home, Workout logging, Nutrition, Progress, and Coach — high-fidelity, meant to be recreated pixel-for-pixel (colors/type/spacing/corner-radius/animation timings), not just "inspired by." Reference prototype: `Gymind UI.dc.html` (interactive, open in any browser).

Per-screen specifics that differ from what's already built, or that spec net-new backend work:
- **Home:** greeting + theme toggle, streak pill (**not yet wired to any backend field** — needs a `consistency`-derived calc or new field), Coach teaser card, Nutrition ring card, Workout CTA card (Start/Resume depending on session state), Best e1RM stat card (decorative shimmer), body weight stat card.
- **Workout:** same session/state model already built (Section 9-11) — this is a re-skin (cut-corner cards, teal/gold, remove left-border pattern) plus the still-open rest timer and finish-session menu (Section 17).
- **Nutrition:** calorie ring + 3 macro bars, "+ Log food" bottom sheet, **photo attachment for meals is UI-only in the design** — needs a `photo_url` column on `nutrition_logs` + a real upload endpoint/storage before it's functional. Empty/loading/error states also newly specified.
- **Progress:** consistency ring, body-weight chart, **a "Progress photos" strip** (same photo-upload caveat as Nutrition — needs its own storage, likely a new `progress_photos` table), 2-column muscle-group tile grid drilling into an e1RM trend line.
- **Coach:** message thread, quick-prompt chips, typing indicator — UI-only with canned replies in the prototype, same as before (Section 16).

> Full design system detail lives in the handoff files under `Design/` once added to the repo (Section 11).

---

## 16. Design System — AI Coach

A dedicated Coach screen/chat exists in the design (mobile + web), referenced contextually from Home, now re-specified under Brand 2.0 with the same message-thread/quick-prompt-chip/typing-indicator shape as before. Still not built on the backend — this is UI/UX design only. Actual LLM integration is Phase 4 (Section 11) and hasn't started.

> Full design system detail lives in the handoff files under `Design/` once added to the repo (Section 11).

---

## 17. Open Questions / Ideas (not committed yet)

- Should `injuries` and `equipment` in `user_profiles` be free-text, arrays, or their own related tables (more structured, more work upfront)?
- Should nutrition tracking use a food database API, or manual entry only, to start?
- What does "AI coach" mean concretely, technically — chat interface via an LLM API, wired to real logged data? (UI is designed; backend approach not decided)
- Where does Profile live on mobile now that it's off the bottom nav?
- Exact icon set for nav items not finalized
- Empty states (no workouts logged yet, no food logged yet) not yet designed
- Error/loading states not yet designed
- `workout_sets.workout_id`'s `ForeignKey` in `models.py` is missing `ondelete='CASCADE'`, even though the real DB has it — needs a model fix so Alembic autogenerate stops flagging it as drift (see Section 10). **Still open as of 2026-09-05.**
- ~~Mobile workout screen's exercise name field is still a free-text `TextInput`~~ — **done.** The exercise picker now searches/filters `GET /exercises` (by name, muscle group, favorites-only), and exercises can be favorited via `POST/DELETE /exercises/{id}/favorite`. This was previously undocumented.
- ~~Workout screen: per-set PREV/TGT display not yet built~~ — **done.** Wired to `GET /exercises/{id}/history`, which returns the most recent prior session's sets plus a suggested target weight. This was previously undocumented.
- ~~Workout screen: per-exercise notes not yet built~~ — **done**, via `PUT /workouts/{id}/exercises/{exercise_id}/note` (`workout_exercise_notes` table). This was previously undocumented.
- Workout screen: rest timer ("REST 2:00") still not built — **still open.**
- Workout screen: "Finish session" secondary options ("...") menu still not built — **still open.**
- Workout screen: sets can still be entered/edited before "Start Session" is pressed (`workoutId` is `null` at that point) — those edits are local-only React state, not persisted anywhere. Not a bug, just ungated — worth deciding whether to block editing until a session starts, or auto-start a session on first edit.
- Workout screen: stat card customization — letting users choose which stats show, since e1RM/volume may not be meaningful to beginner users — idea only, not started.
- Workout screen: finish-workout summary screen/modal — idea only, not started.
- **Intentional deviations from the Login/Register design exports** (not bugs — decisions made while implementing):
  - Login's "Forgot?" link sits on its own row below the password field, not inline with the "PASSWORD" label as shown in the design.
  - Register keeps the app's real field set (username, email, password, confirm password) instead of the design mockup's fields (first name, last name, email, password) — first/last name don't correspond to any column in the actual `users` table (Section 8), and there's no current plan to add them.
  - Register still includes a password strength meter (4-segment, styled to match the design's version) even though the underlying fields differ from the design.
  - Login and Register both show visually-present but non-functional Apple/Google sign-in buttons — explicitly inert (no OAuth wired up), added only for visual parity with the design. Real OAuth isn't currently planned; flagged as a possible future phase if revisited — note Apple sign-in specifically would require Apple Developer Program enrollment, which conflicts with the project's current no-Apple-Developer-account distribution decision.

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
