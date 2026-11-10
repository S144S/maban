"""Store plant photo object keys instead of database blobs (no existing photos)."""

import sqlalchemy as sa
from alembic import op

revision = "d58764dc192a"
down_revision = "c47653cb0819"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM plants.plants WHERE photo_data IS NOT NULL)")).scalar():
        raise RuntimeError("Refusing to discard existing plant photos; export/remove them before upgrading to MinIO")
    op.drop_constraint("plants_photo", "plants", schema="plants", type_="check")
    op.drop_column("plants", "photo_data", schema="plants")
    op.add_column("plants", sa.Column("photo_key", sa.String(200)), schema="plants")
    op.create_index("ix_plants_photo_key", "plants", ["photo_key"], unique=True, schema="plants")
    op.create_check_constraint("plants_photo", "plants", "(photo_digest IS NULL AND photo_key IS NULL) OR "
        "(photo_digest IS NOT NULL AND photo_key IS NOT NULL)", schema="plants")


def downgrade():
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM plants.plants WHERE photo_key IS NOT NULL)")).scalar():
        raise RuntimeError("Refusing to discard MinIO photo references; export/remove photos before downgrade")
    op.drop_constraint("plants_photo", "plants", schema="plants", type_="check")
    op.drop_index("ix_plants_photo_key", "plants", schema="plants")
    op.drop_column("plants", "photo_key", schema="plants")
    op.add_column("plants", sa.Column("photo_data", sa.LargeBinary()), schema="plants")
    op.create_check_constraint("plants_photo", "plants", "(photo_digest IS NULL AND photo_data IS NULL) OR "
        "(photo_digest IS NOT NULL AND photo_data IS NOT NULL "
        "AND octet_length(photo_data) BETWEEN 1 AND 5242880)", schema="plants")
