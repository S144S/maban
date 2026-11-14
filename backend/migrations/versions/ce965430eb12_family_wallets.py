"""Family wallets; preserve personal ledgers and require explicit financial attribution."""

import sqlalchemy as sa
from alembic import op

revision = "ce965430eb12"
down_revision = "bc854329da01"
branch_labels = None
depends_on = None


def upgrade():
    # Operators may populate this table before upgrading; never guess where money belongs.
    op.execute("CREATE TABLE IF NOT EXISTS wallets.ownership_migration "
               "(user_id uuid PRIMARY KEY, family_id uuid NOT NULL)")
    missing = op.get_bind().scalar(sa.text("""
        SELECT EXISTS (
            SELECT 1 FROM wallets.accounts a
            WHERE (a.balance_toman <> 0 OR EXISTS (SELECT 1 FROM wallets.entries e WHERE e.user_id=a.user_id)
                OR EXISTS (SELECT 1 FROM wallets.topups t WHERE t.user_id=a.user_id))
            AND NOT EXISTS (SELECT 1 FROM wallets.ownership_migration m
                JOIN families.memberships f ON f.user_id=m.user_id AND f.family_id=m.family_id
                WHERE m.user_id=a.user_id))
    """))
    if missing:
        raise RuntimeError("Assign every personal wallet with financial records to a family in "
                           "wallets.ownership_migration before upgrading; see docs/wallets.md")
    if op.get_bind().scalar(sa.text("""
        SELECT EXISTS (SELECT 1 FROM wallets.accounts a WHERE a.balance_toman <>
            COALESCE((SELECT SUM(e.amount_toman) FROM wallets.entries e WHERE e.user_id=a.user_id), 0))
    """)):
        raise RuntimeError("Reconcile personal wallet balances against their ledger before upgrading.")
    op.execute("CREATE SCHEMA wallets_legacy")
    for table in ("accounts", "entries", "topups"):
        op.execute(f"ALTER TABLE wallets.{table} SET SCHEMA wallets_legacy")
    op.create_table("accounts",
        sa.Column("family_id", sa.Uuid(), primary_key=True),
        sa.Column("balance_toman", sa.BigInteger(), nullable=False, server_default="0"),
        sa.CheckConstraint("balance_toman >= 0", name="wallet_nonnegative"), schema="wallets")
    op.create_table("entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), sa.ForeignKey("wallets.accounts.family_id"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("reference_id", sa.Uuid(), nullable=False),
        sa.Column("amount_toman", sa.BigInteger(), nullable=False),
        sa.Column("balance_after", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("kind", "reference_id", name="wallet_entry_reference"),
        sa.CheckConstraint("(kind IN ('topup', 'sms_refund') AND amount_toman > 0) OR "
                           "(kind = 'sms' AND amount_toman < 0)", name="wallet_entry_amount"),
        sa.CheckConstraint("balance_after >= 0", name="wallet_entry_balance"), schema="wallets")
    op.create_index("ix_wallet_entries_owner", "entries", ["family_id", "created_at", "id"], schema="wallets")
    op.create_table("topups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), sa.ForeignKey("wallets.accounts.family_id"), nullable=False),
        sa.Column("actor_user_id", sa.Uuid()),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("amount_toman", sa.BigInteger(), nullable=False),
        sa.Column("authority", sa.String(64), nullable=False, unique=True),
        sa.Column("reference", sa.String(64), unique=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("family_id", "request_id", name="wallet_topup_request"),
        sa.CheckConstraint("amount_toman BETWEEN 10000 AND 10000000", name="wallet_topup_amount"),
        sa.CheckConstraint("status IN ('pending', 'paid')", name="wallet_topup_status"), schema="wallets")
    op.create_index("ix_wallet_topups_owner", "topups", ["family_id", "created_at", "id"], schema="wallets")

    op.execute("""
        INSERT INTO wallets.accounts (family_id, balance_toman)
        SELECT m.family_id, SUM(a.balance_toman) FROM wallets_legacy.accounts a
        JOIN wallets.ownership_migration m USING (user_id) GROUP BY m.family_id
    """)
    op.execute("""
        INSERT INTO wallets.entries (id, family_id, kind, reference_id, amount_toman, balance_after, created_at)
        SELECT e.id, m.family_id, e.kind, e.reference_id, e.amount_toman,
            SUM(e.amount_toman) OVER (PARTITION BY m.family_id ORDER BY e.created_at,
                CASE e.kind WHEN 'topup' THEN 0 WHEN 'sms_refund' THEN 1 ELSE 2 END, e.id), e.created_at
        FROM wallets_legacy.entries e JOIN wallets.ownership_migration m USING (user_id)
    """)
    op.execute("""
        INSERT INTO wallets.topups
            (id, family_id, actor_user_id, request_id, amount_toman, authority, reference, status, created_at, paid_at)
        SELECT t.id, m.family_id, t.user_id, t.request_id, t.amount_toman, t.authority,
            t.reference, t.status, t.created_at, t.paid_at
        FROM wallets_legacy.topups t JOIN wallets.ownership_migration m USING (user_id)
    """)
    op.add_column("entries", sa.Column("sms_family_id", sa.Uuid(), nullable=True), schema="reminders")
    op.execute("ALTER TABLE wallets.ownership_migration SET SCHEMA wallets_legacy")
    # Existing personal reminders require an explicit choice before using shared money.
    op.execute("UPDATE reminders.entries SET sms_revision=sms_revision+1")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM wallets.entries) "
                                   "OR EXISTS (SELECT 1 FROM wallets.topups) "
                                   "OR EXISTS (SELECT 1 FROM wallets.accounts WHERE balance_toman <> 0)")):
        raise RuntimeError("Export and explicitly clear family wallet financial records before downgrading.")
    op.drop_column("entries", "sms_family_id", schema="reminders")
    for table in ("topups", "entries", "accounts"):
        op.drop_table(table, schema="wallets")
    for table in ("accounts", "entries", "topups"):
        op.execute(f"ALTER TABLE wallets_legacy.{table} SET SCHEMA wallets")
    op.drop_table("ownership_migration", schema="wallets_legacy")
    op.execute("DROP SCHEMA wallets_legacy")
