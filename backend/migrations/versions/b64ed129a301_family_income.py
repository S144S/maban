"""Create the income module schema and entries in whole tomans."""

import sqlalchemy as sa
from alembic import op

revision = "b64ed129a301"
down_revision = "a83f4d0219ba"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA income")
    op.create_table(
        "entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("amount_toman", sa.BigInteger(), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("from_member_id", sa.Uuid(), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount_toman > 0 AND amount_toman <= 1000000000000", name="income_amount"),
        sa.CheckConstraint("source IN ('salary', 'subsidy', 'voucher', 'gift')", name="income_source"),
        sa.UniqueConstraint("family_id", "request_id", name="income_request"),
        schema="income",
    )
    op.create_index("ix_income_entries_family_id", "entries", ["family_id"], schema="income")


def downgrade():
    op.drop_table("entries", schema="income")
    op.execute("DROP SCHEMA income")
