"""
One-time/re-runnable import of USDA SR Legacy food/nutrient data into the
existing Gymind `foods` table. Only Energy (kcal), Protein, Carbohydrate
(by difference), and Total lipid (fat) are pulled in, per-100g, since
that's all the Food model stores.

Run from backend/:
    python scripts/import_foods.py
"""
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Make `app` importable regardless of the current working directory this
# script is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import engine, SessionLocal
from app.models import Food

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "usda-sr-legacy"

# nutrient_id -> Food column, from nutrient.csv (SR Legacy 2018 release).
NUTRIENT_ID_TO_COLUMN = {
    1008: "calories",
    1003: "protein",
    1005: "carbs",
    1004: "fat",
}

CHUNK_SIZE = 500


def load_foods() -> pd.DataFrame:
    food = pd.read_csv(
        DATA_DIR / "food.csv",
        usecols=["fdc_id", "description"],
    ).rename(columns={"description": "name"})

    food_nutrient = pd.read_csv(
        DATA_DIR / "food_nutrient.csv",
        usecols=["fdc_id", "nutrient_id", "amount"],
    )
    food_nutrient = food_nutrient[food_nutrient["nutrient_id"].isin(NUTRIENT_ID_TO_COLUMN)]

    pivoted = food_nutrient.pivot_table(
        index="fdc_id", columns="nutrient_id", values="amount", aggfunc="first"
    )
    pivoted = pivoted.rename(columns=NUTRIENT_ID_TO_COLUMN).reset_index()

    # Not every food necessarily has all 4 nutrients logged - make sure the
    # columns exist either way so the merge/insert below doesn't KeyError.
    for column in NUTRIENT_ID_TO_COLUMN.values():
        if column not in pivoted.columns:
            pivoted[column] = None

    return food.merge(pivoted, on="fdc_id", how="left")


def to_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for row in df.itertuples(index=False):
        records.append({
            "fdc_id": int(row.fdc_id),
            "name": row.name,
            "calories": float(row.calories) if pd.notna(row.calories) else None,
            "protein": float(row.protein) if pd.notna(row.protein) else None,
            "carbs": float(row.carbs) if pd.notna(row.carbs) else None,
            "fat": float(row.fat) if pd.notna(row.fat) else None,
        })
    return records


def insert_records(records: list[dict]) -> int:
    """Bulk-insert records, skipping any fdc_id already present. Returns
    the number of rows actually inserted."""
    # cursor.rowcount isn't reliable per-batch for a multi-row INSERT ...
    # ON CONFLICT under psycopg3 (it can report -1), so count rows in the
    # table before/after instead of summing rowcount across chunks.
    with SessionLocal() as db:
        before = db.query(Food).count()

    with engine.begin() as conn:
        for i in range(0, len(records), CHUNK_SIZE):
            chunk = records[i:i + CHUNK_SIZE]
            stmt = pg_insert(Food.__table__).values(chunk)
            # fdc_id is UNIQUE - re-running this script just skips rows
            # already imported instead of crashing on the constraint.
            stmt = stmt.on_conflict_do_nothing(index_elements=["fdc_id"])
            conn.execute(stmt)

    with SessionLocal() as db:
        after = db.query(Food).count()

    return after - before


def main():
    df = load_foods()
    records = to_records(df)
    inserted = insert_records(records)
    skipped = len(records) - inserted

    print(f"Considered {len(records)} foods from USDA SR Legacy data.")
    print(f"Inserted {inserted} new rows into `foods`.")
    print(f"Skipped {skipped} rows (fdc_id already present).")


if __name__ == "__main__":
    main()
