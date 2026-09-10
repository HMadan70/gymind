# Gymind

Gymind is a fitness-tracking application for workouts, nutrition, body weight,
and progress. One Expo/React Native codebase targets iOS and Android;
a FastAPI service and PostgreSQL provide the API and persistence layer.

> The AI Coach implementation was intentionally removed on 2026-09-08 so it can
> be rebuilt manually as a learning exercise. The Coach tab remains as a clean
> placeholder. There is currently no AI provider integration or Coach API.

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
- `backend/app/` — FastAPI entry point, authentication, models, schemas, routes.
- `backend/alembic/` — versioned PostgreSQL migrations.
- `backend/tests/` — API and authorization regression tests using `gymind_test`.
- `Design2/` — Brand 2.0 design source and reference assets; not runtime code.
- `PROJECT_STATUS.md` — current feature and validation status.
- `CODEBASE_REVIEW.md` — architecture, security posture, and remaining risks.

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
- `CORS_ORIGINS` — comma-separated trusted web origins.

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

## Validation

```powershell
cd mobile
npx tsc --noEmit
npm run lint -- --max-warnings=0
npx expo-doctor
npx expo export --platform android

cd ../backend
python -m pytest -q
python -m compileall -q app tests
alembic heads
```

Backend tests require a reachable PostgreSQL server and derive a dedicated
database named `gymind_test` from `backend/.env`. The fixture has an explicit
safety assertion and never intentionally uses the development database.

## Server deployment

```sh
cp .env.example .env
docker compose config
docker compose up -d --build
curl http://<server-ip>:8001/health
curl http://<server-ip>:8001/health/db
```

The container image runs Uvicorn without source reload or a source bind mount.
For public deployment, terminate TLS in front of the API, set the real web
origin in `CORS_ORIGINS`, use an SSH tunnel when administering PostgreSQL on its
loopback-only port `5433`, and operate tested backup/migration procedures.
