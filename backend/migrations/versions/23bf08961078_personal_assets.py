"""Create the personal assets module."""

import sqlalchemy as sa
from alembic import op

revision = "23bf08961078"
down_revision = "12aef7850967"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA assets")
    op.create_table("entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("title", sa.String(80)), sa.Column("location", sa.String(200)),
        sa.Column("area_sqm", sa.Numeric(12, 2)),
        sa.Column("brand", sa.String(80)), sa.Column("model", sa.String(80)),
        sa.Column("manufacture_year", sa.Integer()), sa.Column("year_calendar", sa.String(16)),
        sa.Column("purchase_price_toman", sa.BigInteger()), sa.Column("description", sa.String(500)),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('house', 'land', 'car')", name="asset_kind"),
        sa.CheckConstraint("(kind IN ('house', 'land') AND title IS NOT NULL AND length(trim(title)) > 0 AND location IS NOT NULL AND length(trim(location)) > 0 AND area_sqm IS NOT NULL AND area_sqm > 0 AND area_sqm <= 1000000000 AND brand IS NULL AND model IS NULL AND manufacture_year IS NULL AND year_calendar IS NULL) OR (kind = 'car' AND title IS NULL AND location IS NULL AND area_sqm IS NULL AND brand IS NOT NULL AND length(trim(brand)) > 0 AND model IS NOT NULL AND length(trim(model)) > 0 AND manufacture_year IS NOT NULL AND year_calendar IS NOT NULL AND ((year_calendar = 'solar' AND manufacture_year BETWEEN 1200 AND 1500) OR (year_calendar = 'gregorian' AND manufacture_year BETWEEN 1886 AND 2100)))", name="asset_fields"),
        sa.CheckConstraint("purchase_price_toman > 0 AND purchase_price_toman <= 1000000000000", name="asset_price"),
        sa.UniqueConstraint("user_id", "request_id", name="asset_request"), schema="assets")
    op.create_index("ix_assets_entries_user_id", "entries", ["user_id"], schema="assets")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM assets.entries")):
        raise RuntimeError("Export and remove assets before downgrading this migration.")
    op.drop_table("entries", schema="assets")
    op.execute("DROP SCHEMA assets")
