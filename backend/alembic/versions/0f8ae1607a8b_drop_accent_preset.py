"""drop accent_preset

Revision ID: 0f8ae1607a8b
Revises: e3f1f4840e5f
Create Date: 2026-09-06 19:38:29.438738

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0f8ae1607a8b'
down_revision: Union[str, Sequence[str], None] = 'e3f1f4840e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('user_preferences', 'accent_preset')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('user_preferences', sa.Column('accent_preset', sa.TEXT(), autoincrement=False, nullable=True))