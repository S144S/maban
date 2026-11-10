"""Add soil replacement, repotting and examination care actions."""

import sqlalchemy as sa
from alembic import op

revision = "f7a986fe314c"
down_revision = "e69875ed203b"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("plants_care_action", "care_events", schema="plants", type_="check")
    op.create_check_constraint("plants_care_action", "care_events",
        "action IN ('watered', 'not_needed', 'fertilized', 'soil_changed', 'repotted', 'examined')", schema="plants")


def downgrade():
    if op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM plants.care_events WHERE action IN ('soil_changed', 'repotted', 'examined'))"
    )).scalar():
        raise RuntimeError("Refusing to discard new plant care actions; export or restore a backup")
    op.drop_constraint("plants_care_action", "care_events", schema="plants", type_="check")
    op.create_check_constraint("plants_care_action", "care_events",
        "action IN ('watered', 'not_needed', 'fertilized')", schema="plants")
