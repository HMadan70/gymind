"""drop user_preferences.accent_preset

Revision ID: 67cb5152a861
Revises: e3f1f4840e5f
Create Date: 2026-09-05 14:28:56.576477

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '67cb5152a861'
down_revision: Union[str, Sequence[str], None] = 'e3f1f4840e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Trimmed by hand from the raw autogenerate output: this only drops
    user_preferences.accent_preset (retired as part of the Brand 2.0
    migration, PROJECT_STATUS.md Section 14/Phase 3.5 — single fixed
    teal+gold+coral palette, no user-selectable accent presets).
    Autogenerate also proposed a pile of unrelated pre-existing drift
    (missing indexes on several tables, a foods constraint rename, and -
    critically - dropping workout_sets.workout_id's existing ON DELETE
    CASCADE because models.py still doesn't declare it, per the known
    drift item in PROJECT_STATUS.md Section 17). None of that is part of
    this change, so it's been removed rather than applied.
    """
    op.drop_column('user_preferences', 'accent_preset')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('user_preferences', sa.Column('accent_preset', sa.TEXT(), autoincrement=False, nullable=True))
