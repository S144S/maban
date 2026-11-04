"""Persist Lucide icon identifiers for expense categories."""
import sqlalchemy as sa
from alembic import op

revision = "78ac534165cd"
down_revision = "67fb423054bc"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("categories", sa.Column("icon", sa.String(32), nullable=False, server_default="tag"), schema="expenses")


def downgrade():
    op.drop_column("categories", "icon", schema="expenses")
