"""Durable reminder SMS scheduling and occurrence reservations."""

import sqlalchemy as sa
from alembic import op

revision = "f1432098d5e6"
down_revision = "ef032198c4d5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("next_sms_at", sa.DateTime(timezone=True)), schema="reminders")
    op.add_column("entries", sa.Column("sms_revision", sa.Integer(), server_default="0", nullable=False),
                  schema="reminders")
    op.add_column("entries", sa.Column("sms_status", sa.String(10), server_default="pending", nullable=False),
                  schema="reminders")
    op.create_check_constraint("reminder_sms_status", "entries",
                               "sms_status IN ('pending', 'accepted', 'unknown', 'skipped')", schema="reminders")
    op.create_index("ix_reminders_next_sms", "entries", ["next_sms_at", "id"], schema="reminders")
    op.execute("UPDATE reminders.entries SET next_sms_at = due_at WHERE deleted_at IS NULL")
    op.create_table("sms_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reminder_id", sa.Uuid(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.UniqueConstraint("reminder_id", "revision", "due_at", name="reminder_sms_occurrence"),
        sa.CheckConstraint("status IN ('accepted', 'unknown', 'skipped')", name="reminder_attempt_status"),
        schema="reminders",
    )


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM reminders.sms_attempts)")):
        raise RuntimeError("Export and explicitly clear SMS attempts before downgrading to avoid duplicate sends.")
    op.drop_table("sms_attempts", schema="reminders")
    op.drop_index("ix_reminders_next_sms", "entries", schema="reminders")
    op.drop_constraint("reminder_sms_status", "entries", schema="reminders")
    for name in ("sms_status", "sms_revision", "next_sms_at"):
        op.drop_column("entries", name, schema="reminders")
