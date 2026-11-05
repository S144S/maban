"""Private current unit rates, separate from historical purchase prices."""
import sqlalchemy as sa
from alembic import op

revision = "cdf10986a2b3"
down_revision = "bce0987591a2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("rates",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("symbol", sa.String(40), nullable=False),
        sa.Column("unit_price_toman", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "kind", "symbol"),
        sa.CheckConstraint("kind IN ('gold', 'stock', 'silver', 'crypto', 'currency', 'bond')", name="rate_kind"),
        sa.CheckConstraint("unit_price_toman > 0 AND unit_price_toman <= 1000000000000", name="rate_price"),
        sa.CheckConstraint("(kind IN ('gold', 'silver') AND symbol = '') OR (kind NOT IN ('gold', 'silver') AND length(trim(symbol)) > 0)", name="rate_symbol"),
        schema="investments")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM investments.rates)")):
        raise RuntimeError("Export and explicitly clear investment rates before downgrading.")
    op.drop_table("rates", schema="investments")
