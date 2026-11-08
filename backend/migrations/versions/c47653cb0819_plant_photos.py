"""Add private normalized plant photos without loading blobs in plant lists."""

import sqlalchemy as sa
from alembic import op

revision = "c47653cb0819"
down_revision = "b36542baf708"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("plants", sa.Column("photo_digest", sa.String(64)), schema="plants")
    op.add_column("plants", sa.Column("photo_data", sa.LargeBinary()), schema="plants")
    op.create_check_constraint("plants_photo", "plants", "(photo_digest IS NULL AND photo_data IS NULL) OR "
        "(photo_digest IS NOT NULL AND photo_data IS NOT NULL "
        "AND octet_length(photo_data) BETWEEN 1 AND 5242880)", schema="plants")


def downgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM plants.plants WHERE photo_data IS NOT NULL)")).scalar():
        raise RuntimeError("Refusing to discard plant photos; export and explicitly remove photos first")
    op.drop_constraint("plants_photo", "plants", schema="plants", type_="check")
    op.drop_column("plants", "photo_data", schema="plants")
    op.drop_column("plants", "photo_digest", schema="plants")
