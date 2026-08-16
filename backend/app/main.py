import os
from fastapi import FastAPI
from sqlalchemy import create_engine, text

app = FastAPI(title="Gymind API")

# Read the database URL from an environment variable rather than hardcoding it.
# This is what lets the *same* code work whether Postgres is on localhost (rare,
# we're not doing that) or on the server — only the .env value changes.
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL) if DATABASE_URL else None


@app.get("/")
def root():
    return {"message": "Gymind API is running"}


@app.get("/health")
def health_check():
    """Confirms the API process is alive, independent of the database."""
    return {"status": "ok"}


@app.get("/health/db")
def db_health_check():
    """Confirms the API can actually reach and query Postgres."""
    if engine is None:
        return {"status": "error", "detail": "DATABASE_URL not set"}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
