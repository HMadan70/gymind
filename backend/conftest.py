"""
Shared pytest fixtures for the backend test suite.

Tests run against a separate "gymind_test" Postgres database - same
server as dev, different db name - built by swapping the database name
on the real DATABASE_URL from .env. Tests never touch the real "gymind"
database: routes get their db session from a dependency override, not
from app.database's real engine.

Table setup/teardown strategy: each test gets Base.metadata.create_all()
before it runs and Base.metadata.drop_all() after (see db_session below).
This is simpler than the alternative - wrapping each test in one
connection/transaction and rolling back at the end - which would require
every route's own db.commit() calls to be transaction-savepoint-aware to
avoid prematurely committing outside the test's rollback boundary.
Recreating the (still small) schema per test is slower but exactly
matches what the routes' own commit() calls already do, and this app's
test suite is nowhere near large enough yet for the speed difference to
matter.
"""
import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

load_dotenv(Path(__file__).resolve().parent / ".env")

_real_db_url = make_url(os.environ["DATABASE_URL"])
TEST_DATABASE_URL = _real_db_url.set(database="gymind_test")

# Safety net: never let a bug in the swap above point tests at the real
# "gymind" database, where create_all()/drop_all() would be destructive.
assert TEST_DATABASE_URL.database == "gymind_test", (
    f"Refusing to run tests against database {TEST_DATABASE_URL.database!r} "
    "- expected 'gymind_test'"
)

test_engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Import after TEST_DATABASE_URL is validated: importing app.main pulls in
# every route module, which pulls in app.models, which is what actually
# registers every table on Base.metadata for create_all()/drop_all() below.
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def db_session():
    """Fresh schema, fresh session, for exactly one test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client(db_session):
    """TestClient wired to the test DB session instead of the real one."""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
