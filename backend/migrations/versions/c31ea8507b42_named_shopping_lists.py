"""Group existing shopping items into named lists without losing receipts."""

from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op

revision = "c31ea8507b42"
down_revision = "f09ab23d715c"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("lists",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.UniqueConstraint("family_id", "id", name="shopping_list_family"),
        sa.UniqueConstraint("family_id", "request_id", name="shopping_list_request"),
        sa.CheckConstraint("length(trim(name)) > 0", name="shopping_list_name"), schema="shopping")
    op.add_column("items", sa.Column("list_id", sa.Uuid(), nullable=True), schema="shopping")
    db = op.get_bind()
    families = db.execute(sa.text("SELECT DISTINCT ON (family_id) family_id, created_by, created_at "
        "FROM shopping.items ORDER BY family_id, created_at, id")).all()
    for family_id, actor, created_at in families:
        list_id = uuid5(NAMESPACE_URL, f"maban-shopping:{family_id}")
        db.execute(sa.text("INSERT INTO shopping.lists VALUES (:id, :family, :name, :actor, :at, :id, 'legacy')"),
                   {"id": list_id, "family": family_id, "name": "لیست خرید", "actor": actor, "at": created_at})
        db.execute(sa.text("UPDATE shopping.items SET list_id=:id WHERE family_id=:family"),
                   {"id": list_id, "family": family_id})
    op.alter_column("items", "list_id", nullable=False, schema="shopping")
    op.create_foreign_key("shopping_item_list", "items", "lists", ["family_id", "list_id"],
                          ["family_id", "id"], source_schema="shopping", referent_schema="shopping")
    op.create_index("ix_shopping_list", "items", ["list_id", "deleted_at", "purchased_at"], schema="shopping")


def downgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM shopping.lists)")).scalar():
        raise RuntimeError("Refusing to discard named shopping lists; export or restore a backup")
    op.drop_constraint("shopping_item_list", "items", schema="shopping", type_="foreignkey")
    op.drop_index("ix_shopping_list", table_name="items", schema="shopping")
    op.drop_column("items", "list_id", schema="shopping")
    op.drop_table("lists", schema="shopping")
