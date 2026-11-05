"""Add family money locations and optional attribution for legacy income clients."""
import sqlalchemy as sa
from alembic import op

revision = "d86ab341c523"
down_revision = "c75fa230b412"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA money_locations")
    op.create_table(
        "locations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("family_id", "name", name="location_family_name"),
        sa.UniqueConstraint("family_id", "request_id", name="location_request"),
        schema="money_locations",
    )
    op.create_index("ix_money_locations_locations_family_id", "locations", ["family_id"], schema="money_locations")
    op.add_column("entries", sa.Column("location_id", sa.Uuid()), schema="income")
    op.add_column("entries", sa.Column("location_name", sa.String(80)), schema="income")


def downgrade():
    op.drop_column("entries", "location_name", schema="income")
    op.drop_column("entries", "location_id", schema="income")
    op.drop_table("locations", schema="money_locations")
    op.execute("DROP SCHEMA money_locations")
