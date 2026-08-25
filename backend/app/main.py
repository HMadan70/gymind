import os
from fastapi import FastAPI
from sqlalchemy import create_engine, text
from slowapi.errors import RateLimitExceeded

from app.database import Base, engine
from app.rate_limit import limiter, rate_limit_exceeded_handler
from app.routes.workout_routes import router as workout_router
from app.routes.auth_routes import router as auth_router
from app.routes.profile_routes import router as profile_router

app = FastAPI(title="Gymind API")
app.include_router(workout_router)
app.include_router(auth_router)
app.include_router(profile_router)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Creates any tables defined in models.py that don't already exist yet.
# This is fine for early development - once the schema stabilizes and
# you have real data you care about, you'd switch to a migration tool
# (Alembic) instead of relying on this, since create_all() never alters
# or drops existing columns, only adds brand-new tables.
Base.metadata.create_all(bind=engine)

DATABASE_URL = os.getenv("DATABASE_URL")
health_engine = create_engine(DATABASE_URL) if DATABASE_URL else None


@app.get("/")
def root():
    return {"message": "Gymind API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def db_health_check():
    if health_engine is None:
        return {"status": "error", "detail": "DATABASE_URL not set"}
    try:
        with health_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
