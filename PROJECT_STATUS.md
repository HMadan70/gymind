# Gymind — Project Documentation

_Last updated: 2026-08-17_

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

---

## 6. Deployment & Server Access

- **Server OS:** ZimaOS (Docker-based)
- **SSH access:** `ssh root@192.168.0.241`
- **Repo path on server:** `/DATA/gymind`
- **Containers:**
  - `db` — Postgres 16, `5433:5432`
  - `backend` — FastAPI, `8001:8000`
- **DB GUI access:** TablePlus → host `192.168.0.241`, port `5433`
- **Server git policy:** server only ever runs `git pull` — never commits or pushes. All code changes happen on dev laptops.
- **Restart after a pull:** `docker compose up -d --build` (rebuilds the backend image if code changed; not needed for doc-only changes)

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
| `injuries` | text (free-form) or a related table | Needs design decision — see Section 17 |
| `equipment` | text[] or related table | e.g. "dumbbells", "barbell", "none" |
| `dietary_restrictions` | text[] or related table | e.g. "vegetarian", "gluten-free" |
| `created_at` | timestamp | Default now() |
| `updated_at` | timestamp | Update on edit |

### `user_preferences` — planned, not built
Needed to support the theming system (Section 14):
| Column | Type (draft) | Notes |
|---|---|---|
| `id` | int/serial | Primary key |
| `user_id` | int (FK → users.id) | One row per user |
| `theme_mode` | text/enum | "dark" or "light" |
| `accent_preset` | text/enum | One of: Ember, Signal, Amber, Violet, Teal, Volt |
| `updated_at` | timestamp | Update on edit |

### `workouts` — not designed yet
Will need at minimum: workout sessions, exercises performed, sets/reps/weight per exercise, timestamps. Design screens imply we'll also need: session duration, target vs. actual weight per set (for the "TGT 190" style previous/target display), and a way to compute e1RM (estimated 1-rep max) per exercise for Progress charts.

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
| — | `get_current_user` dependency | 🔧 In progress | Reads JWT from `Authorization` header, validates it, returns the current `User` for protected routes — **today's task, not yet started** |

### Health
| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/health` | ✅ Built | Basic liveness check |
| GET | `/health/db` | ✅ Built | Checks DB connectivity |

### Planned
| Method | Path | Status | Description |
|---|---|---|---|
| GET/POST | `/users/profile` | ❌ Not built | Read/create/update `user_profiles` |
| GET/POST | `/users/preferences` | ❌ Not built | Theme mode + accent color, to support the theming system |
| GET/POST | `/workouts` | ❌ Not built | List/create workout sessions |
| GET/PUT/DELETE | `/workouts/{id}` | ❌ Not built | Get/update/delete a specific workout |
| GET/POST | `/nutrition` | ❌ Not built | List/create nutrition log entries |
| GET/POST | `/body-weight` | ❌ Not built | Log/list body weight entries for Progress chart |
| GET | `/progress` | ❌ Not built | Aggregated stats/trends — scoped per design: body weight trend, e1RM trend per exercise, muscle-group strength summary |
| POST | `/coach` | ❌ Not built | AI coach interaction endpoint — chat UI is fully designed, backend/LLM integration not started |

---

## 10. Key Technical Decisions & Gotchas

- **bcrypt pinned to `4.0.1`** — needed for compatibility with `passlib==1.7.4`. If either is upgraded later, re-verify password hashing still works before deploying.
- **Non-default ports** (`5433` for Postgres, `8001` for backend) — because other containers on the home server already occupy the defaults. Keep this in mind in `.env` files, TablePlus configs, and any new service that needs to talk to these.
- **Git & OneDrive** — repo clones are intentionally kept outside OneDrive sync folders to avoid `.git` corruption/conflicts from cloud sync.
- **Server never commits** — treat the server as a deploy target only, not a place to edit code.
- **Theming is presentation-only** — theme/accent changes affect color tokens only; layout, spacing, and typography never change per theme. Worth keeping this discipline in the actual React Native implementation (e.g. a single theme context object, not per-component conditional styling).

---

## 11. Roadmap — Detailed Developer Tasks

### Phase 1 — Auth & Users (current)
- [x] `users` table
- [x] Register / login endpoints
- [x] JWT issuing on login
- [ ] **JWT route protection** — today's task
  - [ ] Write `get_current_user` dependency: extract `Authorization: Bearer <token>` header
  - [ ] Decode/verify JWT signature and expiry
  - [ ] Look up user by id from token payload; raise `401` if invalid/missing/expired
  - [ ] Apply `Depends(get_current_user)` to a test route to confirm it works end-to-end
  - [ ] Decide token expiry length and whether refresh tokens are needed later
- [ ] **`user_profiles` table**
  - [ ] Finalize schema (see open question on injuries/equipment structure, Section 17)
  - [ ] Write migration (or manual `CREATE TABLE` if not using a migration tool yet)
  - [ ] Build `POST /users/profile` (create/update, requires auth)
  - [ ] Build `GET /users/profile` (requires auth, returns current user's profile)
  - [ ] Decide: is profile creation mandatory before using the rest of the app (onboarding gate)?
- [ ] **`user_preferences` table**
  - [ ] Design schema (theme_mode, accent_preset)
  - [ ] Build `GET/POST /users/preferences`

### Phase 2 — Core Tracking
- [ ] **Workouts**
  - [ ] Design `workouts`, `exercises`, and `workout_sets` tables (or similar normalized structure)
  - [ ] `POST /workouts` — create a workout session
  - [ ] `GET /workouts` — list past workouts for current user
  - [ ] `GET /workouts/{id}` — workout detail
  - [ ] `PUT /workouts/{id}` — edit
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
- [ ] Build onboarding screen wired to `/users/profile`
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
- **Theming discipline:** color tokens only change per theme — never layout/spacing/typography (see Section 10)

---

## 14. Design System — Direction & Theming

Design work was done collaboratively in Claude Design (claude.ai/design). Full screen exports live in `Design/exports/` (source files in `Design/Source/`).

### Design Direction
- **Style:** "5c" direction — dark base, geometric sans typography, warm accent
- **Typeface:** Sora (throughout — headings, body, and numerals; tabular figures used for aligned data)
- **Default accent:** Ember (`#FF6B1F`)
- **Base mode:** Dark (default), Light mode available
- **Tone:** Clean, modern, slightly energetic — data-forward without feeling clinical

### Theming System
Users can change the **accent color** and **light/dark mode** — layout, spacing, and typography stay fixed; only color tokens change.

![Theming comparison grid](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/theming-comparison-grid.png)

**Accent presets (final shortlist of 6):**
| Preset | Hex |
|---|---|
| Ember (default) | `#FF6B1F` |
| Signal | `#3FC4FF` |
| Amber | `#FFD023` |
| Violet | `#A788FA` |
| Teal | `#17C382` |
| Volt | `#3FE07A` |

_(Explored but not shortlisted: Coral, Indigo, Crimson)_

![Base token reference](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/base-token-reference.png)

**Base tokens — dark mode:**
| Token | Value | Use |
|---|---|---|
| `bg.base` | `#0A0F1A` | Screen background |
| `bg.card` | `#131B2B` | Card / input fill |
| `bg.inset` | `rgba(255,255,255,.045)` | Subtle inset surfaces |
| `border` | `rgba(255,255,255,.14)` | Card/input borders |
| `text.primary` | `#F0F3F8` | Headings, body |
| `text.dim` | 72% opacity | Secondary text |
| `text.faint` | 42% opacity | Tertiary/placeholder text |

**Base tokens — light mode:**
| Token | Value | Use |
|---|---|---|
| `bg.base` | `#F4F5F7` | Screen background |
| `bg.card` | `#FFFFFF` | Card / input fill |
| `bg.inset` | `#F4F5F7` | Subtle inset surfaces |
| `border` | `rgba(16,20,28,.14)` | Card/input borders |
| `text.primary` | `#10141C` | Headings, body |
| `text.dim` | 68% opacity | Secondary text |
| `text.faint` | 42% opacity | Tertiary/placeholder text |

**Accent contract (applies per-preset, both modes):**
| Token | Use |
|---|---|
| `accent` | Fills, active borders |
| `accent.tint2` | Dark-mode text/icons on accent-tinted surfaces |
| `accent.tint3` | Charts, rings, data visualization |
| `accent.deep` | Light-mode text on accent-tinted surfaces |
| `accent.on` | Text rendered on top of a solid accent fill |
| `accent.soft` | 16% wash — subtle accent backgrounds |

---

## 15. Design System — Screens

**Bottom nav (mobile) / sidebar (web):** Home, Coach, Workout, Nutrition, Progress, Settings — Profile moved out of the bottom bar to keep the nav from overcrowding at 6 items (see open question, Section 17).

### Login
| Mobile | Web |
|---|---|
| ![Login - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-login.png) | ![Login - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-login.png) |

### Register
| Mobile | Web |
|---|---|
| ![Register - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-register.png) | ![Register - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-register.png) |

### Onboarding
Grouped steps: goal, experience, injuries, equipment, dietary restrictions.
| Mobile | Web |
|---|---|
| ![Onboarding - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-onboarding.png) | ![Onboarding - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-onboarding.png) |

### Home
Section order (finalized): greeting header → **This week** streak strip (7-day dot/check row, no card border) → **AI Coach card** (contextual tip, links to Coach chat) → **Nutrition card** (calorie ring + macro bars + recent food logged, one combined card) → **Workout card** (today's plan + recent workouts, one combined card).
| Mobile | Web |
|---|---|
| ![Home - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-home.png) | ![Home - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-home.png) |

### Workout (logging)
Session header, set-by-set logging, add exercise, finish session.
| Mobile | Web |
|---|---|
| ![Workout - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-workout.png) | ![Workout - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-workout.png) |

### Nutrition
Calorie ring, macro bars, recent food logged.
| Mobile | Web |
|---|---|
| ![Nutrition - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-nutrition.png) | ![Nutrition - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-nutrition.png) |

### Progress
Finalized structure: time range selector (4 weeks/3 months/1 year) → **body weight chart** (line chart, goal marker) → **strength by muscle group** (drillable: muscle group → specific exercise → e1RM trend line) → **consistency** (single line, e.g. "18 of 28 days trained").
| Mobile | Web |
|---|---|
| ![Progress - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-progress.png) | ![Progress - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-progress.png) |

### Settings
Includes the theme picker (dark/light mode + 6 accent swatches).
| Mobile | Web |
|---|---|
| ![Settings - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-settings.png) | ![Settings - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-settings.png) |

---

## 16. Design System — AI Coach

Accessed via its own nav tab (Coach). Referenced contextually on Home (workout-specific tips) and has its own dedicated chat screen: header with back nav, message thread (coach messages in accent-tinted cards), quick-prompt chips (e.g. "Adjust today's plan," "How's my progress this month?"), text input, "Beta"/"Preview" label.

| Mobile | Web |
|---|---|
| ![Coach - mobile](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/mobile/mobile-coach.png) | ![Coach - web](https://raw.githubusercontent.com/HMadan70/gymind/main/Design/exports/web/web-coach.png) |

**Not yet built on the backend** — this is UI/UX design only. Actual LLM integration is Phase 4 (Section 11) and hasn't been started.

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
