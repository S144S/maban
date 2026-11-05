"""Shared durable SMS queue for OTP and reminders."""

import sqlalchemy as sa
from alembic import op

revision = "a25431a9e6f7"
down_revision = "f1432098d5e6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA messaging")
    op.create_table("sms_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("reference_id", sa.Uuid(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("encrypted_payload", sa.Text()),
        sa.UniqueConstraint("kind", "reference_id", name="sms_job_reference"),
        sa.CheckConstraint("status IN ('pending', 'processing', 'accepted', 'failed', 'unknown', 'skipped')",
                           name="sms_job_status"),
        schema="messaging",
    )
    op.create_index("ix_sms_jobs_ready", "sms_jobs", ["status", "priority", "available_at", "id"],
                    schema="messaging")
    op.create_index("ix_sms_jobs_claimed", "sms_jobs", ["status", "claimed_at"], schema="messaging")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM messaging.sms_jobs)")):
        raise RuntimeError("Export and explicitly clear SMS jobs before downgrading to avoid duplicate sends.")
    op.drop_table("sms_jobs", schema="messaging")
    op.execute("DROP SCHEMA messaging")
