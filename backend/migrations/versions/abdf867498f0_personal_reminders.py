"""Store personal reminders; delivery is not enabled."""
import sqlalchemy as sa
from alembic import op

revision = "abdf867498f0"
down_revision = "9ace756387ef"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA reminders")
    op.create_table(
        "entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("amount_toman", sa.BigInteger(), nullable=True),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "request_id", name="reminder_request"),
        sa.CheckConstraint("amount_toman IS NULL OR (amount_toman > 0 AND amount_toman <= 1000000000000)",
                           name="reminder_amount"),
        schema="reminders",
    )
    op.create_index("ix_reminders_user_due", "entries", ["user_id", "due_at", "id"], schema="reminders")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM reminders.entries)")):
        raise RuntimeError("Export and explicitly clear reminder records before downgrading.")
    op.drop_table("entries", schema="reminders")
    op.execute("DROP SCHEMA reminders")
