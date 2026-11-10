"""Add family shopping lists with versioned edits and durable create retries."""

import sqlalchemy as sa
from alembic import op

revision = "aa7c3e21bd90"
down_revision = "d2ea71b93508"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA shopping")
    op.create_table("items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("quantity", sa.String(80), nullable=False),
        sa.Column("note", sa.String(500), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("purchased_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.UniqueConstraint("family_id", "request_id", name="shopping_request"),
        sa.CheckConstraint("version > 0", name="shopping_version"),
        sa.CheckConstraint("length(trim(name)) > 0", name="shopping_name"),
        sa.CheckConstraint("(purchased_at IS NULL) = (purchased_by IS NULL)", name="shopping_purchase"),
        schema="shopping")
    op.create_index("ix_shopping_family", "items",
                    ["family_id", "deleted_at", "purchased_at", "created_at", "id"], schema="shopping")


def downgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM shopping.items)")).scalar():
        raise RuntimeError("Refusing to discard shopping data; export or restore a backup")
    op.drop_table("items", schema="shopping")
    op.execute("DROP SCHEMA shopping")
