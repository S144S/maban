"""Additional family recipients for reminder SMS."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e8da512fc940"
down_revision = "d7c8412eab30"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("recipient_user_ids", postgresql.ARRAY(sa.Uuid()),
                                      nullable=False, server_default="{}"), schema="reminders")
    op.add_column("sms_attempts", sa.Column("recipient_user_id", sa.Uuid()), schema="reminders")
    op.execute("UPDATE reminders.sms_attempts a SET recipient_user_id = r.user_id "
               "FROM reminders.entries r WHERE r.id = a.reminder_id")
    op.alter_column("sms_attempts", "recipient_user_id", nullable=False, schema="reminders")
    op.drop_constraint("reminder_sms_occurrence", "sms_attempts", schema="reminders", type_="unique")
    op.create_unique_constraint("reminder_sms_occurrence", "sms_attempts",
        ["reminder_id", "revision", "due_at", "recipient_user_id"], schema="reminders")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM reminders.entries "
        "WHERE cardinality(recipient_user_ids) > 0) OR EXISTS (SELECT 1 FROM reminders.sms_attempts a "
        "JOIN reminders.entries r ON r.id=a.reminder_id WHERE a.recipient_user_id <> r.user_id)")):
        raise RuntimeError("Preserve recipient selections and delivery history before rolling back.")
    op.drop_constraint("reminder_sms_occurrence", "sms_attempts", schema="reminders", type_="unique")
    op.create_unique_constraint("reminder_sms_occurrence", "sms_attempts",
        ["reminder_id", "revision", "due_at"], schema="reminders")
    op.drop_column("sms_attempts", "recipient_user_id", schema="reminders")
    op.drop_column("entries", "recipient_user_ids", schema="reminders")
