"""Preserve deleted accounts and historical income references."""
import sqlalchemy as sa
from alembic import op

revision = "e97bc452d634"
down_revision = "d86ab341c523"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("locations", sa.Column("deleted_at", sa.DateTime(timezone=True)), schema="money_locations")


def downgrade():
    op.drop_column("locations", "deleted_at", schema="money_locations")
