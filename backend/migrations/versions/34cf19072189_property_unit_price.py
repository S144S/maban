"""Store property unit prices separately from historical purchase totals."""

import sqlalchemy as sa
from alembic import op

revision = "34cf19072189"
down_revision = "23bf08961078"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("price_per_sqm_toman", sa.BigInteger()), schema="assets")
    op.create_check_constraint("asset_sqm_price", "entries",
        "price_per_sqm_toman IS NULL OR (kind IN ('house', 'land') AND price_per_sqm_toman > 0 AND price_per_sqm_toman <= 1000000000000)", schema="assets")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM assets.entries WHERE price_per_sqm_toman IS NOT NULL")):
        raise RuntimeError("Export and clear property unit prices before downgrading.")
    op.drop_constraint("asset_sqm_price", "entries", schema="assets")
    op.drop_column("entries", "price_per_sqm_toman", schema="assets")
