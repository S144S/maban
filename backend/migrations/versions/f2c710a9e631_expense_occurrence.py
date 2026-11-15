"""Separate expense occurrence from recording time."""

import sqlalchemy as sa
from alembic import op

revision = "f2c710a9e631"
down_revision = "e8da512fc940"
branch_labels = None
depends_on = None


def upgrade():
    # NULL preserves the recording-time behavior for legacy and default entries.
    op.add_column("entries", sa.Column("occurred_at", sa.DateTime(timezone=True)), schema="expenses")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM expenses.entries "
                                   "WHERE occurred_at IS NOT NULL AND occurred_at <> created_at)")):
        raise RuntimeError("Preserve custom expense dates before rolling back.")
    op.drop_column("entries", "occurred_at", schema="expenses")
