"""Add optional recurring monthly category limits in tomans."""
from alembic import op
import sqlalchemy as sa

revision = "9ace756387ef"
down_revision = "89bd645276de"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("categories", sa.Column("monthly_limit_toman", sa.BigInteger(), nullable=True), schema="expenses")
    op.create_check_constraint("expense_category_monthly_limit", "categories",
                               "monthly_limit_toman IS NULL OR (monthly_limit_toman > 0 AND monthly_limit_toman <= 1000000000000)",
                               schema="expenses")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM expenses.categories WHERE monthly_limit_toman IS NOT NULL)")):
        raise RuntimeError("Clear category monthly limits before downgrading.")
    op.drop_constraint("expense_category_monthly_limit", "categories", schema="expenses", type_="check")
    op.drop_column("categories", "monthly_limit_toman", schema="expenses")
