"""Support reminders recurring every fourteen days."""

import sqlalchemy as sa
from alembic import op

revision = "d2ea71b93508"
down_revision = "c1df3920ab72"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("reminder_recurrence", "entries", schema="reminders", type_="check")
    op.alter_column("entries", "recurrence", type_=sa.String(11), existing_type=sa.String(7),
                    existing_nullable=False, schema="reminders")
    op.create_check_constraint("reminder_recurrence", "entries",
        "recurrence IN ('none', 'daily', 'weekly', 'fortnightly', 'monthly')", schema="reminders")


def downgrade():
    if op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM reminders.entries WHERE recurrence = 'fortnightly')"
    )).scalar():
        raise RuntimeError("Export and explicitly change fortnightly reminders before downgrading")
    op.drop_constraint("reminder_recurrence", "entries", schema="reminders", type_="check")
    op.alter_column("entries", "recurrence", type_=sa.String(7), existing_type=sa.String(11),
                    existing_nullable=False, schema="reminders")
    op.create_check_constraint("reminder_recurrence", "entries",
        "recurrence IN ('none', 'daily', 'weekly', 'monthly')", schema="reminders")
