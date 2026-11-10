"""Remove plant schedules while preserving plants, photos and performed care."""

import sqlalchemy as sa
from alembic import op

revision = "e69875ed203b"
down_revision = "d58764dc192a"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("plants_soil_interval", "plants", schema="plants", type_="check")
    op.drop_constraint("plants_fertilizer_schedule", "plants", schema="plants", type_="check")
    for column in ("soil_interval", "soil_due", "fertilizer_interval", "fertilizer_due"):
        op.drop_column("plants", column, schema="plants")
    op.drop_column("care_events", "next_due", schema="plants")


def downgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM plants.plants)")).scalar():
        raise RuntimeError("Refusing to fabricate removed plant schedules; restore a pre-upgrade backup")
    # An empty module can safely restore its previous schema without inventing data.
    for name, kind, nullable in (
        ("soil_interval", sa.Integer(), False),
        ("soil_due", sa.Date(), False),
        ("fertilizer_interval", sa.Integer(), True),
        ("fertilizer_due", sa.Date(), True),
    ):
        op.add_column("plants", sa.Column(name, kind, nullable=nullable), schema="plants")
    op.add_column("care_events", sa.Column("next_due", sa.Date(), nullable=False), schema="plants")
    op.create_check_constraint("plants_soil_interval", "plants", "soil_interval BETWEEN 1 AND 365", schema="plants")
    op.create_check_constraint("plants_fertilizer_schedule", "plants",
        "(fertilizer_interval IS NULL AND fertilizer_due IS NULL) OR "
        "(fertilizer_interval IS NOT NULL AND fertilizer_interval BETWEEN 1 AND 365 "
        "AND fertilizer_due IS NOT NULL)", schema="plants")
