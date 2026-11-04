"""Move existing user data into its owning module schema, without copying it."""

from alembic import op

revision = "7b31e920af01"
down_revision = "54574e5efd16"
branch_labels = None
depends_on = None

TABLES = ("users", "user_sessions", "user_otp_challenges", "user_rate_buckets")


def upgrade():
    # Fail on a pre-existing schema rather than silently taking ownership of it.
    op.execute("CREATE SCHEMA users")
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} SET SCHEMA users")


def downgrade():
    for table in reversed(TABLES):
        op.execute(f"ALTER TABLE users.{table} SET SCHEMA public")
    # No CASCADE: unexpected objects must not be deleted.
    op.execute("DROP SCHEMA users")
