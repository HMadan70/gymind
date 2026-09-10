# Gymind

Gymind is a fitness-tracking application for workouts, nutrition, body
weight, progress (including meal and progress photos), and an AI coach
grounded in your own logged data. One Expo/React Native codebase targets
iOS and Android (there is no web build - see Architecture); a FastAPI
service and PostgreSQL provide the API and persistence layer.

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current, detailed
feature-by-feature status, database/migration state, and known limitations.
This README covers what the project is and how to run it.

## Architecture

```text
Expo / React Native (iOS + Android)
              │ JSON REST + bearer JWT
              ▼
         FastAPI API
              │ SQLAlchemy
              ▼
         PostgreSQL 16
```

- `mobile/` — Expo SDK 57 app, Expo Router routes, shared UI and theme.
  Mobile-only: `app.json` declares `"platforms": ["ios", "android"]`, so a
  web build is refused rather than silently attempted.
- `backend/app/` — FastAPI entry point, authentication, models, schemas,
  routes, the Coach's prompt/provider logic, and its rate limiter.
- `backend/alembic/` — versioned PostgreSQL migrations.
- `backend/tests/` — API, authorization, and Coach regression tests, run
  against a separate `gymind_test` database (see Testing below).
- `db-init/` — creates `gymind_test` alongside the production database on a
  fresh Postgres volume, for both local Docker Compose and CI.
- `Design2/` — Brand 2.0 design source and reference assets; not runtime
  code. Icons are [Lucide](https://lucide.dev/).
- `.github/workflows/` — CI (backend tests only; see Continuous integration).
- `PROJECT_STATUS.md` — current feature and validation status.

## Features

- Email/username + password auth (bcrypt, JWT), onboarding/profile,
  dark/light theme synced to the account.
- Workout logging: sessions, sets, custom and shared exercises, favorites,
  per-exercise history, notes.
- Nutrition logging: food search/create/favorite, daily targets
  (auto-calculated or manual), a server-computed daily summary, optional
  meal photos.
- Body weight logging and trend.
- Progress: e1RM trend per exercise (Epley formula), muscle-group strength
  summary, consistency streak, a progress-photo gallery.
- AI Coach: chat grounded in the caller's own training/nutrition/body-weight
  data via an OpenRouter-backed LLM, with per-conversation history and a
  per-user rate limit.

## Configuration

Never commit real `.env` files. Copy the relevant example and replace all
placeholder values:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item mobile/.env.example mobile/.env
```

Backend/server variables:

- `DATABASE_URL` — SQLAlchemy PostgreSQL URL for local backend execution.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — Compose database values.
- `JWT_SECRET` — long, random signing secret; required at startup.
- `CORS_ORIGINS` — comma-separated trusted origins.
- `OPENROUTER_API_KEY` — Coach's LLM provider key. Unset disables
  `POST /coach` (it returns 503); the rest of the API is unaffected. Never
  exposed to the client - the mobile app never sees this value.
- `OPENROUTER_MODEL` — defaults to `anthropic/claude-sonnet-4.5`.
- `COACH_RATE_LIMIT_REQUESTS`, `COACH_RATE_LIMIT_WINDOW_SECONDS` — per-user
  Coach rate limit, default 10 requests / 60 seconds. See
  `backend/app/coach_rate_limit.py` for the (in-memory, single-process)
  implementation and its documented scaling limits.
- `UPLOAD_DIR` — local-disk storage for meal/progress photos, defaults to
  `backend/uploads/` (gitignored).

Frontend variable:

- `EXPO_PUBLIC_API_URL` — API base URL embedded in the app bundle. It is
  required for every build; use the reachable local API origin during
  development and an HTTPS origin for deployed builds.

## Local development

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Mobile:

```powershell
cd mobile
npm ci
npm start
```

## Testing

Backend tests require a reachable PostgreSQL server and run against a
dedicated `gymind_test` database, never the development/production one -
`backend/conftest.py` swaps to it automatically and asserts it did so
before touching anything. `db-init/001-create-test-db.sh` creates that
database alongside the main one on a fresh Postgres volume (Docker
Compose mounts it into `docker-entrypoint-initdb.d`; CI runs it directly).

Coach tests never call the real OpenRouter API - every test stubs
`coach_service.request_completion`, the one function that performs that
network call.

```powershell
cd backend
python -m pytest -q
python -m compileall -q app tests
alembic heads
```

Mobile has no automated test suite yet; validation is static checks plus a
native export:

```powershell
cd mobile
npx tsc --noEmit
npm run lint -- --max-warnings=0
npx expo-doctor
npx expo export --platform android
```

## Continuous integration

`.github/workflows/backend-tests.yml` runs the backend test suite on every
push and pull request to `main`: a real Postgres 16 service container, the
same `gymind_test` setup used locally, then `pytest`. It uses throwaway
CI-only credentials and never configures a real `OPENROUTER_API_KEY` -
nothing in CI ever calls the real LLM provider. There is no frontend CI yet.

## Server deployment

```sh
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose exec backend alembic upgrade head
curl http://<server-ip>:8001/health
curl http://<server-ip>:8001/health/db
```

The container image runs Uvicorn without source reload or a source bind
mount. PostgreSQL is published loopback-only on port `5433`; use an SSH
tunnel for remote database administration or to run the backend test suite
from a workstation against it. For public deployment, terminate TLS in
front of the API, set the real origin(s) in `CORS_ORIGINS`, and operate
tested backup/migration procedures.

## Known limitations

See `PROJECT_STATUS.md`'s "Next priorities" for the current list -
notably: no token refresh/revocation yet (a compromised token is valid for
its full 7-day lifetime), native token storage is AsyncStorage rather than
a platform keychain, and the Coach rate limiter is in-memory and
per-process (documented in `backend/app/coach_rate_limit.py`), appropriate
for this app's current single-process deployment but not for multiple
workers or hosts without a shared backend.

## License

MIT — see [`LICENSE`](LICENSE).
