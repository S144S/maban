"""Current property and vehicle rates, separate from purchase prices."""
import sqlalchemy as sa
from alembic import op

revision = "def21097b3c4"
down_revision = "cdf10986a2b3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("current_unit_price_toman", sa.BigInteger()), schema="assets")
    op.add_column("entries", sa.Column("rate_updated_at", sa.DateTime(timezone=True)), schema="assets")
    op.create_check_constraint("asset_current_price", "entries", "current_unit_price_toman IS NULL OR (current_unit_price_toman > 0 AND current_unit_price_toman <= 1000000000000)", schema="assets")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM assets.entries WHERE current_unit_price_toman IS NOT NULL)")):
        raise RuntimeError("Export and explicitly clear asset rates before downgrading.")
    op.drop_constraint("asset_current_price", "entries", schema="assets")
    op.drop_column("entries", "rate_updated_at", schema="assets")
    op.drop_column("entries", "current_unit_price_toman", schema="assets")
