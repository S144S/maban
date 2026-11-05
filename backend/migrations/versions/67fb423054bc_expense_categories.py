"""Add family expense categories, preserving legacy expense classifications."""
import sqlalchemy as sa
from alembic import op

revision = "67fb423054bc"
down_revision = "56ea312943ab"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("categories",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("family_id", "name", name="expense_category_name"),
        sa.UniqueConstraint("family_id", "request_id", name="expense_category_request"),
        schema="expenses")
    op.create_index("ix_expenses_categories_family_id", "categories", ["family_id"], schema="expenses")
    op.add_column("entries", sa.Column("category_id", sa.Uuid(), nullable=True), schema="expenses")
    op.add_column("entries", sa.Column("category_name", sa.String(80), nullable=True), schema="expenses")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM expenses.categories")):
        raise RuntimeError("Expense categories exist; export or remove them explicitly before downgrade.")
    op.drop_column("entries", "category_name", schema="expenses")
    op.drop_column("entries", "category_id", schema="expenses")
    op.drop_table("categories", schema="expenses")
