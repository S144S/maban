"""Keep durable receipts for atomic shopping list completion."""

import sqlalchemy as sa
from alembic import op

revision = "e8a1d6342fc9"
down_revision = "c31ea8507b42"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("checkouts",
        sa.Column("list_id", sa.Uuid(), primary_key=True),
        sa.Column("request_id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("expense_id", sa.Uuid(), nullable=True),
        sa.Column("completed_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["family_id", "list_id"], ["shopping.lists.family_id", "shopping.lists.id"],
                                name="shopping_checkout_list"),
        sa.CheckConstraint("completed_count >= 0", name="shopping_checkout_count"), schema="shopping")


def downgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM shopping.checkouts)")).scalar():
        raise RuntimeError("Refusing to discard shopping checkout receipts")
    op.drop_table("checkouts", schema="shopping")
