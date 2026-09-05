"""add nutrition_logs.photo_url and progress_photos table

Revision ID: 0a61975bbfa4
Revises: 67cb5152a861
Create Date: 2026-09-05 15:21:17.321666

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0a61975bbfa4'
down_revision: Union[str, Sequence[str], None] = '67cb5152a861'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Trimmed by hand from the raw autogenerate output: this only adds
    nutrition_logs.photo_url and the progress_photos table (Brand 2.0
    photo-upload support, PROJECT_STATUS.md Phase 3.5). Autogenerate also
    proposed a pile of unrelated pre-existing drift (missing indexes,
    a foods constraint rename, and the known workout_sets CASCADE
    drift item, PROJECT_STATUS.md Section 17) - none of that is part of
    this change, so it's been removed rather than applied.
    """
    op.create_table('progress_photos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('photo_url', sa.Text(), nullable=False),
    sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_progress_photos_id'), 'progress_photos', ['id'], unique=False)
    op.add_column('nutrition_logs', sa.Column('photo_url', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('nutrition_logs', 'photo_url')
    op.drop_index(op.f('ix_progress_photos_id'), table_name='progress_photos')
    op.drop_table('progress_photos')
