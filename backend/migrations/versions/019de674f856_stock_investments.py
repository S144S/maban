"""Support stock holdings while preserving existing gold entries."""

import sqlalchemy as sa
from alembic import op

revision = "019de674f856"
down_revision = "f08cd563e745"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("symbol", sa.String(40)), schema="investments")
    op.add_column("entries", sa.Column("shares", sa.BigInteger()), schema="investments")
    op.alter_column("entries", "grams", nullable=True, schema="investments")
    op.drop_constraint("investment_kind", "entries", schema="investments")
    op.create_check_constraint("investment_kind", "entries", "kind IN ('gold', 'stock')", schema="investments")
    op.create_check_constraint("investment_fields", "entries",
        "(kind = 'gold' AND grams IS NOT NULL AND symbol IS NULL AND shares IS NULL) OR "
        "(kind = 'stock' AND grams IS NULL AND symbol IS NOT NULL AND length(trim(symbol)) > 0 "
        "AND shares IS NOT NULL AND shares > 0 AND shares <= 1000000000 AND total_price_toman IS NULL)",
        schema="investments")


def downgrade():
    # Refuse a lossy downgrade: export/remove stock entries explicitly first.
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT count(*) FROM investments.entries WHERE kind = 'stock'")):
        raise RuntimeError("Export and remove stock investments before downgrading this migration.")
    op.drop_constraint("investment_fields", "entries", schema="investments")
    op.drop_constraint("investment_kind", "entries", schema="investments")
    op.create_check_constraint("investment_kind", "entries", "kind = 'gold'", schema="investments")
    op.alter_column("entries", "grams", nullable=False, schema="investments")
    op.drop_column("entries", "shares", schema="investments")
    op.drop_column("entries", "symbol", schema="investments")
