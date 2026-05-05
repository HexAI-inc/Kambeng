"""Drop plaintext email verification code column

Revision ID: 0b71f7d8e2aa
Revises: c924a0d5f2e1
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0b71f7d8e2aa"
down_revision: Union[str, None] = "c924a0d5f2e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "email_verification_code")


def downgrade() -> None:
    op.add_column("users", sa.Column("email_verification_code", sa.String(length=6), nullable=True))
