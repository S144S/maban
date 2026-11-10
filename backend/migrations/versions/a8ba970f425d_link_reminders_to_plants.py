"""Add optional family plant references to personal reminders."""

import sqlalchemy as sa
from alembic import op

revision = "a8ba970f425d"
down_revision = "f7a986fe314c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("plant_family_id", sa.Uuid(), nullable=True), schema="reminders")
    op.add_column("entries", sa.Column("plant_id", sa.Uuid(), nullable=True), schema="reminders")
    op.create_check_constraint("reminder_plant_reference", "entries",
        "(plant_family_id IS NULL AND plant_id IS NULL) OR "
        "(plant_family_id IS NOT NULL AND plant_id IS NOT NULL)", schema="reminders")


def downgrade():
    if op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM reminders.entries WHERE plant_id IS NOT NULL)"
    )).scalar():
        raise RuntimeError("Refusing to discard plant reminder links; export or restore a backup")
    op.drop_constraint("reminder_plant_reference", "entries", schema="reminders", type_="check")
    op.drop_column("entries", "plant_id", schema="reminders")
    op.drop_column("entries", "plant_family_id", schema="reminders")
