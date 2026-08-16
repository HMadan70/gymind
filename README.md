# Gymind

Fitness tracking app: workouts, nutrition, progress, and an AI coach in one account.

## Stack
- Backend: Python / FastAPI
- Database: PostgreSQL
- Mobile + Web: React Native (Expo) + React Native Web
- Deployment: Docker Compose on a home server (ZimaOS)

## Running on the server

1. SSH into the server and clone this repo (or `git pull` if already cloned).
2. Copy `.env.example` to `.env` and fill in real values:
   ```
   cp .env.example .env
   ```
3. Start the stack:
   ```
   docker compose up -d --build
   ```
4. Check it's alive:
   ```
   curl http://<server-ip>:8000/health
   curl http://<server-ip>:8000/health/db
   ```

## Developing from a second device

Postgres only runs on the server. Point your local backend's `DATABASE_URL`
at the server's IP instead of `localhost` when developing off-server, or just
develop directly against the containers running on the server.
