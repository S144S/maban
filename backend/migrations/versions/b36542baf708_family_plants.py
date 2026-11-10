"""Family plants and atomic care history."""

import sqlalchemy as sa
from alembic import op

revision = "b36542baf708"
down_revision = "a25431a9e6f7"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA plants")
    op.create_table("plants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("species", sa.String(120), nullable=False),
        sa.Column("location", sa.String(120), nullable=False),
        sa.Column("note", sa.String(2000), nullable=False),
        sa.Column("assignee_id", sa.Uuid()),
        sa.Column("soil_interval", sa.Integer(), nullable=False),
        sa.Column("soil_due", sa.Date(), nullable=False),
        sa.Column("fertilizer_interval", sa.Integer()),
        sa.Column("fertilizer_due", sa.Date()),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("family_id", "request_id", name="plants_request"),
        sa.CheckConstraint("soil_interval BETWEEN 1 AND 365", name="plants_soil_interval"),
        sa.CheckConstraint("(fertilizer_interval IS NULL AND fertilizer_due IS NULL) OR "
                           "(fertilizer_interval IS NOT NULL AND fertilizer_interval BETWEEN 1 AND 365 "
                           "AND fertilizer_due IS NOT NULL)",
                           name="plants_fertilizer_schedule"),
        schema="plants")
    op.create_index("ix_plants_family", "plants", ["family_id", "deleted_at", "id"], schema="plants")
    op.create_table("care_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("plant_id", sa.Uuid(), sa.ForeignKey("plants.plants.id"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("note", sa.String(2000), nullable=False),
        sa.Column("performed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_due", sa.Date(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.UniqueConstraint("family_id", "request_id", name="plants_care_request"),
        sa.CheckConstraint("action IN ('watered', 'not_needed', 'fertilized')", name="plants_care_action"),
        schema="plants")
    op.create_index("ix_plants_history", "care_events", ["plant_id", "performed_at", "id"], schema="plants")


def downgrade():
    connection = op.get_bind()
    if connection.execute(sa.text("SELECT EXISTS (SELECT 1 FROM plants.plants)")).scalar():
        raise RuntimeError("Refusing to discard plants or care history; export and explicitly clear data first")
    op.drop_table("care_events", schema="plants")
    op.drop_table("plants", schema="plants")
    op.execute("DROP SCHEMA plants")
