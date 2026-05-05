"""Create campaign aliases table for short URL codes

Revision ID: e8c2a9b6d3f5
Revises: d7a4b2e5f1c8
Create Date: 2026-04-06 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e8c2a9b6d3f5"
down_revision: Union[str, None] = "d7a4b2e5f1c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create campaign_aliases table
    op.create_table(
        "campaign_aliases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("short_code", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("short_code", name="uq_short_code")
    )
    op.create_index(op.f("ix_campaign_aliases_campaign_id"), "campaign_aliases", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_campaign_aliases_short_code"), "campaign_aliases", ["short_code"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_campaign_aliases_short_code"), table_name="campaign_aliases")
    op.drop_index(op.f("ix_campaign_aliases_campaign_id"), table_name="campaign_aliases")
    op.drop_table("campaign_aliases")
