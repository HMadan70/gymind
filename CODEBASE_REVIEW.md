# Gymind Codebase Review

_Updated: 2026-09-08_

## Scope

This document records the current architecture, security boundaries, and known
engineering risks. It describes the repository as it exists today; it is not a
development diary or deployment runbook.

## System architecture

Gymind is a three-tier application:

```text
Expo / React Native / React Native Web
                | JSON REST + bearer JWT
                v
             FastAPI
                | SQLAlchemy
                v
           PostgreSQL 16
```

- `mobile/src/app/` contains Expo Router screens and navigation.
- `mobile/src/components/` contains reusable interface components.
- `mobile/src/context/` and `mobile/src/lib/` provide theme and session/API
  infrastructure.
- `backend/app/main.py` assembles middleware and API routers.
- `backend/app/routes/` owns HTTP endpoints and feature-level business logic.
- `backend/app/models.py` and `backend/app/schemas.py` define persistence and
  request/response contracts.
- `backend/alembic/` contains versioned PostgreSQL migrations.
- `backend/tests/` contains API, validation, and authorization regressions.

The mobile and web experiences share one Expo codebase. There is no separate
web backend or independent web application.

## Authentication and authorization

Registration and login issue an HS256 JWT. The frontend stores the token with
AsyncStorage and sends it through the shared authenticated request helper as an
`Authorization: Bearer <token>` header. Protected FastAPI routes resolve the
current user through dependencies in `backend/app/auth.py`.

Authorization is enforced at the query boundary: user-owned workout,
nutrition, body-weight, profile, preference, note, and favorite operations
filter by the authenticated user's identifier. Shared exercise and food records
are readable by all authenticated users; private records remain owner-scoped.
Indirect operations validate that referenced foods and exercises are visible to
the caller.

Authentication routes are rate limited. The signing secret is required at
startup and is loaded only from server configuration. The current seven-day
access token has no refresh or revocation mechanism; that remains a production
hardening item.

## Data model

The PostgreSQL schema contains:

- users, profiles, and preferences;
- workouts, workout sets, and per-exercise workout notes;
- shared/private exercises and exercise favorites;
- shared/private foods, food favorites, nutrition logs, and nutrition targets;
- body-weight logs.

Alembic has one linear migration head, `9c4a1b7fe210`. The AI Coach reset did
not require a migration because the removed implementation had no dedicated
database tables. Cascade changes are intentionally deferred until account
deletion semantics are specified and tested.

## Feature flow

Screens load and mutate data through the shared API/session helpers. FastAPI
validates JSON with Pydantic schemas, resolves the authenticated user, applies
ownership and visibility filters, and executes SQLAlchemy queries in a scoped
database session. Responses return typed JSON to the Expo screen, which updates
local React state and renders the result.

The main implemented domains are authentication/onboarding, workout tracking,
exercise history and favorites, nutrition logs and targets, body weight, and
progress summaries. Detailed status is maintained in `PROJECT_STATUS.md`.

## AI Coach status

AI Coach is intentionally reset and currently under reconstruction. The
previous frontend chat state, local history, backend endpoint, prompt/context
assembly, provider client, and OpenRouter configuration were removed. The
navigation position remains, and `mobile/src/app/(tabs)/coach.tsx` renders only
a themed placeholder. No Coach request or AI provider call is made.

## Configuration and deployment

Example environment files document names and safe placeholders only. Real
environment files are ignored. Server secrets and database credentials must
never be exposed through `EXPO_PUBLIC_*` variables because Expo embeds those
values in the client bundle.

Docker Compose runs PostgreSQL and the FastAPI service. PostgreSQL is published
only on the host loopback interface, and the API image runs Uvicorn without
development reload or a source bind mount. Public deployments should terminate
TLS in front of the API and restrict `CORS_ORIGINS` to trusted web origins.

## Security posture

Current controls include:

- authenticated ownership filters and regression tests for primary resources;
- bounded Pydantic inputs for fitness and nutrition data;
- password hashing and generic authentication failures;
- startup rejection of missing or placeholder JWT signing secrets;
- configurable CORS origins;
- generic database health errors;
- ignored local secrets and pre-commit secret scanning;
- a dedicated test-database safety assertion.

Remaining security work includes a formal token refresh/revocation design,
production TLS verification, backup/restore exercises, dependency remediation
when compatible Expo updates are available, and broader rate limiting if public
traffic warrants it. The mobile client currently stores a seven-day bearer token
with AsyncStorage; native SecureStore and a short-lived, revocable session model
should be evaluated before production launch. Registration also returns a
distinct duplicate-identifier response, which can permit account enumeration,
and the bcrypt configuration should either reject passwords over 72 UTF-8 bytes
or use a hash scheme that safely incorporates the full accepted password.

## Quality and known limitations

The backend has API and authorization tests. The frontend currently relies on
TypeScript, ESLint, Expo Doctor, and static web export rather than a dedicated
component test suite. Photo upload/storage, workout rest timing, desktop-specific
web polish, and the rebuilt Coach remain incomplete.

The repository deliberately retains `Design2/` as a non-runtime Brand 2.0
reference. Its interactive HTML and design notes are inputs for visual work, not
an alternative application implementation.

## Validation baseline

The latest full validation recorded in `PROJECT_STATUS.md` passes backend tests,
Python compilation, TypeScript, ESLint, Expo Doctor, and Expo web export. Docker
Compose must still be validated in an environment where Docker is installed.
