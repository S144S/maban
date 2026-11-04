"""Preserve original expense assignment for retries after category management."""
from alembic import op
import sqlalchemy as sa

revision = "89bd645276de"
down_revision = "78ac534165cd"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("submitted_category_id", sa.Uuid(), nullable=True), schema="expenses")
    op.execute("UPDATE expenses.entries SET submitted_category_id = category_id")


def downgrade():
    op.drop_column("entries", "submitted_category_id", schema="expenses")
