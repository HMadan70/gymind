#!/bin/sh
# Runs only on a brand-new Postgres data directory (the official image's
# docker-entrypoint-initdb.d convention: scripts here execute once, on
# first init of an empty volume - never again against existing data).
#
# Creates gymind_test alongside the main POSTGRES_DB database, owned by
# the same app role. This is what makes the separate test database
# survive a volume rebuild - without it, a fresh `docker compose up` would
# recreate only the production database, and backend/conftest.py's swap
# to "gymind_test" (see its own docstring) would fail with
# "database does not exist" until someone created it by hand again, the
# way it was originally created.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-SQL
    SELECT 'CREATE DATABASE gymind_test OWNER ${POSTGRES_USER}'
    WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'gymind_test')\gexec
SQL
