import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

# A "session" is a temporary workspace for talking to the database -
# it tracks changes you make and lets you commit them (save) or roll
# them back (discard) as a unit.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is what our table models (like User) will inherit from -
# it's how SQLAlchemy knows a Python class represents a database table.
Base = declarative_base()


def get_db():
    """
    FastAPI "dependency" - each request that needs the database calls
    this, gets a fresh session, uses it, and the session is guaranteed
    to close afterward (even if an error happens), thanks to try/finally.
    This pattern avoids leaking open database connections over time.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
