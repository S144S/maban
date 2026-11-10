"""Add optional personal reminder notes."""

import sqlalchemy as sa
from alembic import op

revision = "c1df3920ab72"
down_revision = "a8ba970f425d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("note", sa.String(2000), nullable=True), schema="reminders")


def downgrade():
    if op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM reminders.entries WHERE note IS NOT NULL)"
    )).scalar():
        raise RuntimeError("Refusing to discard reminder notes; export or restore a backup")
    op.drop_column("entries", "note", schema="reminders")
