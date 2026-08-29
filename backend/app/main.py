import os
from fastapi import FastAPI
from sqlalchemy import create_engine, text
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware


from app.rate_limit import limiter, rate_limit_exceeded_handler
from app.routes.workout_routes import router as workout_router
from app.routes.auth_routes import router as auth_router
from app.routes.profile_routes import router as profile_router
from app.routes.nutrition_routes import router as nutrition_router
from app.routes.body_weight_routes import router as body_weight_router
from app.routes.progress_routes import router as progress_router

app = FastAPI(title="Gymind API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workout_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(nutrition_router)
app.include_router(body_weight_router)
app.include_router(progress_router)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

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



