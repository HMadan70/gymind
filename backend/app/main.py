import os
from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware


from app.rate_limit import limiter, rate_limit_exceeded_handler
from app.database import engine
from app.routes.workout_routes import router as workout_router
from app.routes.auth_routes import router as auth_router
from app.routes.profile_routes import router as profile_router
from app.routes.nutrition_routes import router as nutrition_router
from app.routes.body_weight_routes import router as body_weight_router
from app.routes.progress_routes import router as progress_router
from app.routes.coach_routes import router as coach_router


app = FastAPI(title="Gymind API")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8081,http://localhost:19006",
    ).split(",")
    if origin.strip()
]
if "*" in CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS must list trusted origins; wildcard is not allowed")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
app.include_router(coach_router)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

@app.get("/")
def root():
    return {"message": "Gymind API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def db_health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc



