"""
Seeds the shared (user_id IS NULL) reference rows in `foods` and
`exercises` from the CSV snapshots in backend/data/seed/. Re-runnable
against an already-seeded database - both parts skip rows that already
exist rather than erroring or duplicating.

Replaces the old scripts/import_foods.py, which read the original USDA
SR Legacy CSVs directly (food.csv, food_nutrient.csv, etc. under
data/usda-sr-legacy/). Those source files were dropped from the repo
before this script existed - data/seed/foods.csv is a flat export of
the 7,793 shared foods that were already live in production, taken
directly from the database rather than re-derived from USDA's raw
format. There was never a seeder for exercises at all; data/seed/
exercises.csv is the same kind of export for the 119 shared exercises.

Run from backend/:
    python scripts/seed_reference_data.py
"""
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Make `app` importable regardless of the current working directory this
# script is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import engine, SessionLocal
from app.models import Exercise, Food

SEED_DIR = Path(__file__).resolve().parent.parent / "data" / "seed"
CHUNK_SIZE = 500


def seed_foods() -> None:
    df = pd.read_csv(SEED_DIR / "foods.csv")
    records = [
        {
            "fdc_id": int(row.fdc_id),
            "name": row.name,
            "calories": float(row.calories) if pd.notna(row.calories) else None,
            "protein": float(row.protein) if pd.notna(row.protein) else None,
            "carbs": float(row.carbs) if pd.notna(row.carbs) else None,
            "fat": float(row.fat) if pd.notna(row.fat) else None,
        }
        for row in df.itertuples(index=False)
    ]

    with SessionLocal() as db:
        before = db.query(Food).count()

    # fdc_id is UNIQUE, so ON CONFLICT DO NOTHING is enough to make
    # re-running this safe - it just skips rows already imported.
    with engine.begin() as conn:
        for i in range(0, len(records), CHUNK_SIZE):
            chunk = records[i:i + CHUNK_SIZE]
            stmt = pg_insert(Food.__table__).values(chunk)
            stmt = stmt.on_conflict_do_nothing(index_elements=["fdc_id"])
            conn.execute(stmt)

    with SessionLocal() as db:
        after = db.query(Food).count()

    inserted = after - before
    print(f"Foods: considered {len(records)}, inserted {inserted}, skipped {len(records) - inserted}.")


def seed_exercises() -> None:
    df = pd.read_csv(SEED_DIR / "exercises.csv")
    records = [
        {"name": row.name, "muscle_group": row.muscle_group, "user_id": None}
        for row in df.itertuples(index=False)
    ]

    # exercises has no unique constraint to hang ON CONFLICT off of (a
    # shared exercise name is enforced by convention, not the schema), so
    # idempotency is done here instead: skip any name that's already a
    # shared (user_id IS NULL) exercise before inserting.
    with SessionLocal() as db:
        existing_names = {
            name for (name,) in db.query(Exercise.name).filter(Exercise.user_id.is_(None)).all()
        }
        to_insert = [r for r in records if r["name"] not in existing_names]

        for i in range(0, len(to_insert), CHUNK_SIZE):
            db.bulk_insert_mappings(Exercise, to_insert[i:i + CHUNK_SIZE])
        db.commit()

    skipped = len(records) - len(to_insert)
    print(f"Exercises: considered {len(records)}, inserted {len(to_insert)}, skipped {skipped}.")


def main():
    seed_foods()
    seed_exercises()


if __name__ == "__main__":
    main()
