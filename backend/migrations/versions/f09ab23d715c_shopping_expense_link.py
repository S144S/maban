"""Link a shopping item to its single optional financial expense."""

import sqlalchemy as sa
from alembic import op

revision = "f09ab23d715c"
down_revision = "aa7c3e21bd90"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("items", sa.Column("expense_id", sa.Uuid(), nullable=True), schema="shopping")


def downgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM shopping.items WHERE expense_id IS NOT NULL)")).scalar():
        raise RuntimeError("Refusing to discard shopping expense links")
    op.drop_column("items", "expense_id", schema="shopping")
