"""Add hashed email verification column

Revision ID: c924a0d5f2e1
Revises: 7f2a3f1c9b2d
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c924a0d5f2e1"
down_revision: Union[str, None] = "7f2a3f1c9b2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verification_code_hash", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "email_verification_code_hash")
