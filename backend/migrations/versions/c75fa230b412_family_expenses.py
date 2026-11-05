"""Create the expenses module schema and entries in whole tomans."""

import sqlalchemy as sa
from alembic import op

revision = "c75fa230b412"
down_revision = "b64ed129a301"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA expenses")
    op.create_table(
        "entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("amount_toman", sa.BigInteger(), nullable=False),
        sa.Column("category", sa.String(16), nullable=False),
        sa.Column("paid_by_member_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount_toman > 0 AND amount_toman <= 1000000000000", name="expenses_amount"),
        sa.CheckConstraint("category IN ('home', 'groceries', 'leisure', 'other')", name="expenses_category"),
        sa.UniqueConstraint("family_id", "request_id", name="expenses_request"),
        schema="expenses",
    )
    op.create_index("ix_expenses_entries_family_id", "entries", ["family_id"], schema="expenses")


def downgrade():
    op.drop_table("entries", schema="expenses")
    op.execute("DROP SCHEMA expenses")
