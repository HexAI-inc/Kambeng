"""Add campaign goals table and donation goal reference

Revision ID: c1d2e3f4a5b6
Revises: e1f2a3b4c5d6
Create Date: 2026-05-05 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure the Postgres enum type exists without relying on SQLAlchemy's
    # Enum.create() (which can still attempt to CREATE TYPE during table
    # creation and raise if the type already exists). Use a safe DO block.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goalstatus') THEN
                CREATE TYPE goalstatus AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');
            END IF;
        END$$;
        """
    )

    op.create_table(
        "campaign_goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("target_amount", sa.Float(), nullable=False),
        sa.Column("amount_raised", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'DRAFT'")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_campaign_goals_id"), "campaign_goals", ["id"], unique=False)
    op.create_index(op.f("ix_campaign_goals_campaign_id"), "campaign_goals", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_campaign_goals_title"), "campaign_goals", ["title"], unique=False)
    op.create_index(op.f("ix_campaign_goals_status"), "campaign_goals", ["status"], unique=False)

    # Remove the textual default so the column can be cast to the enum type
    op.execute("ALTER TABLE campaign_goals ALTER COLUMN status DROP DEFAULT;")
    # Convert the status column to the Postgres enum now that the type exists
    op.execute("ALTER TABLE campaign_goals ALTER COLUMN status TYPE goalstatus USING status::goalstatus;")
    # Re-establish the enum-typed default
    op.execute("ALTER TABLE campaign_goals ALTER COLUMN status SET DEFAULT 'DRAFT'::goalstatus;")

    op.add_column("donations", sa.Column("goal_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_donations_goal_id"), "donations", ["goal_id"], unique=False)
    op.create_foreign_key(
        "fk_donations_goal_id_campaign_goals",
        "donations",
        "campaign_goals",
        ["goal_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_donations_goal_id_campaign_goals", "donations", type_="foreignkey")
    op.drop_index(op.f("ix_donations_goal_id"), table_name="donations")
    op.drop_column("donations", "goal_id")

    op.drop_index(op.f("ix_campaign_goals_status"), table_name="campaign_goals")
    op.drop_index(op.f("ix_campaign_goals_title"), table_name="campaign_goals")
    op.drop_index(op.f("ix_campaign_goals_campaign_id"), table_name="campaign_goals")
    op.drop_index(op.f("ix_campaign_goals_id"), table_name="campaign_goals")
    op.drop_table("campaign_goals")

    goal_status = sa.Enum(name="goalstatus")
    goal_status.drop(op.get_bind(), checkfirst=True)
