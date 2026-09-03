"""add workout_exercise_notes table

Revision ID: e3f1f4840e5f
Revises: 28028c6fc495
Create Date: 2026-09-03 18:30:30.954282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e3f1f4840e5f'
down_revision: Union[str, Sequence[str], None] = '28028c6fc495'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Trimmed by hand from the raw autogenerate output: this only creates
    workout_exercise_notes. Autogenerate also proposed a pile of unrelated
    changes (missing indexes on several tables, a foods constraint rename,
    and - critically - dropping workout_sets.workout_id's existing
    ON DELETE CASCADE because models.py still doesn't declare it, per the
    known drift item in PROJECT_STATUS.md Section 17). None of that is
    part of this change, so it's been removed rather than applied.
    """
    op.create_table('workout_exercise_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('workout_id', sa.Integer(), nullable=False),
    sa.Column('exercise_id', sa.Integer(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ),
    sa.ForeignKeyConstraint(['workout_id'], ['user_workouts.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('workout_id', 'exercise_id', name='uq_workout_exercise_notes_workout_exercise')
    )
    op.create_index(op.f('ix_workout_exercise_notes_id'), 'workout_exercise_notes', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_workout_exercise_notes_id'), table_name='workout_exercise_notes')
    op.drop_table('workout_exercise_notes')
