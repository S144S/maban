"""Add silver, cryptocurrency, currency and bonds without changing existing holdings."""

import sqlalchemy as sa
from alembic import op

revision = "12aef7850967"
down_revision = "019de674f856"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("quantity", sa.Numeric(28, 18)), schema="investments")
    op.drop_constraint("investment_fields", "entries", schema="investments")
    op.drop_constraint("investment_kind", "entries", schema="investments")
    op.create_check_constraint("investment_kind", "entries", "kind IN ('gold', 'stock', 'silver', 'crypto', 'currency', 'bond')", schema="investments")
    op.create_check_constraint("investment_fields", "entries", "((kind IN ('gold', 'silver') AND grams IS NOT NULL AND symbol IS NULL AND shares IS NULL AND quantity IS NULL AND (kind = 'gold' OR total_price_toman IS NULL)) OR (kind = 'stock' AND grams IS NULL AND symbol IS NOT NULL AND length(trim(symbol)) > 0 AND shares IS NOT NULL AND shares > 0 AND shares <= 1000000000 AND total_price_toman IS NULL AND quantity IS NULL) OR (kind IN ('crypto', 'currency', 'bond') AND grams IS NULL AND shares IS NULL AND symbol IS NOT NULL AND length(trim(symbol)) > 0 AND quantity IS NOT NULL AND quantity > 0 AND quantity <= 1000000000 AND total_price_toman IS NULL AND (kind != 'bond' OR quantity = trunc(quantity)) AND (kind != 'currency' OR quantity = trunc(quantity, 2))))", schema="investments")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM investments.entries WHERE kind NOT IN ('gold', 'stock')")):
        raise RuntimeError("Export and remove new investment types before downgrading.")
    op.drop_constraint("investment_fields", "entries", schema="investments")
    op.drop_constraint("investment_kind", "entries", schema="investments")
    op.create_check_constraint("investment_kind", "entries", "kind IN ('gold', 'stock')", schema="investments")
    op.create_check_constraint("investment_fields", "entries", "(kind = 'gold' AND grams IS NOT NULL AND symbol IS NULL AND shares IS NULL) OR (kind = 'stock' AND grams IS NULL AND symbol IS NOT NULL AND length(trim(symbol)) > 0 AND shares IS NOT NULL AND shares > 0 AND shares <= 1000000000 AND total_price_toman IS NULL)", schema="investments")
    op.drop_column("entries", "quantity", schema="investments")
