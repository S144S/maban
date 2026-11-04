"""Allow a single combined car model while preserving historical brands."""
import sqlalchemy as sa
from alembic import op

revision = "45df20183290"
down_revision = "34cf19072189"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("asset_fields", "entries", schema="assets")
    op.create_check_constraint("asset_fields", "entries", "(kind IN ('house', 'land') AND title IS NOT NULL AND length(trim(title)) > 0 AND location IS NOT NULL AND length(trim(location)) > 0 AND area_sqm IS NOT NULL AND area_sqm > 0 AND area_sqm <= 1000000000 AND brand IS NULL AND model IS NULL AND manufacture_year IS NULL AND year_calendar IS NULL) OR (kind = 'car' AND title IS NULL AND location IS NULL AND area_sqm IS NULL AND (brand IS NULL OR length(trim(brand)) > 0) AND model IS NOT NULL AND length(trim(model)) > 0 AND manufacture_year IS NOT NULL AND year_calendar IS NOT NULL AND ((year_calendar = 'solar' AND manufacture_year BETWEEN 1200 AND 1500) OR (year_calendar = 'gregorian' AND manufacture_year BETWEEN 1886 AND 2100)))", schema="assets")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM assets.entries WHERE kind = 'car' AND brand IS NULL")):
        raise RuntimeError("Supply brands for cars before downgrading.")
    op.drop_constraint("asset_fields", "entries", schema="assets")
    op.create_check_constraint("asset_fields", "entries", "(kind IN ('house', 'land') AND title IS NOT NULL AND length(trim(title)) > 0 AND location IS NOT NULL AND length(trim(location)) > 0 AND area_sqm IS NOT NULL AND area_sqm > 0 AND area_sqm <= 1000000000 AND brand IS NULL AND model IS NULL AND manufacture_year IS NULL AND year_calendar IS NULL) OR (kind = 'car' AND title IS NULL AND location IS NULL AND area_sqm IS NULL AND brand IS NOT NULL AND length(trim(brand)) > 0 AND model IS NOT NULL AND length(trim(model)) > 0 AND manufacture_year IS NOT NULL AND year_calendar IS NOT NULL AND ((year_calendar = 'solar' AND manufacture_year BETWEEN 1200 AND 1500) OR (year_calendar = 'gregorian' AND manufacture_year BETWEEN 1886 AND 2100)))", schema="assets")
