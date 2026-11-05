"""Store reminder recurrence preferences without scheduling delivery."""
import sqlalchemy as sa
from alembic import op

revision = "bce0987591a2"
down_revision = "abdf867498f0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entries", sa.Column("recurrence", sa.String(7), nullable=False,
                                      server_default="none"), schema="reminders")
    op.create_check_constraint("reminder_recurrence", "entries",
                               "recurrence IN ('none', 'daily', 'weekly', 'monthly')",
                               schema="reminders")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM reminders.entries WHERE recurrence <> 'none')")):
        raise RuntimeError("Export and explicitly clear recurrence preferences before downgrading.")
    op.drop_constraint("reminder_recurrence", "entries", schema="reminders", type_="check")
    op.drop_column("entries", "recurrence", schema="reminders")
