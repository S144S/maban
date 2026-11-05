"""Add personal gold investments, isolated from family cash balances."""

import sqlalchemy as sa
from alembic import op

revision = "f08cd563e745"
down_revision = "e97bc452d634"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA investments")
    op.create_table(
        "entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("grams", sa.Numeric(10, 3), nullable=False),
        sa.Column("unit_price_toman", sa.BigInteger()),
        sa.Column("total_price_toman", sa.BigInteger()),
        sa.Column("description", sa.String(500)),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind = 'gold'", name="investment_kind"),
        sa.CheckConstraint("grams > 0 AND grams <= 1000000", name="investment_grams"),
        sa.CheckConstraint("unit_price_toman > 0 AND unit_price_toman <= 1000000000000", name="investment_unit_price"),
        sa.CheckConstraint("total_price_toman > 0 AND total_price_toman <= 1000000000000", name="investment_total_price"),
        sa.UniqueConstraint("user_id", "request_id", name="investment_request"),
        schema="investments",
    )
    op.create_index("ix_investments_entries_user_id", "entries", ["user_id"], schema="investments")


def downgrade():
    op.drop_table("entries", schema="investments")
    op.execute("DROP SCHEMA investments")
