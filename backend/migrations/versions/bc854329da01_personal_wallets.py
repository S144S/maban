"""Personal prepaid wallets and verified payment receipts."""

import sqlalchemy as sa
from alembic import op

revision = "bc854329da01"
down_revision = "e8a1d6342fc9"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA wallets")
    op.create_table("accounts",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("balance_toman", sa.BigInteger(), nullable=False, server_default="0"),
        sa.CheckConstraint("balance_toman >= 0", name="wallet_nonnegative"), schema="wallets")
    op.create_table("entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("wallets.accounts.user_id"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("reference_id", sa.Uuid(), nullable=False),
        sa.Column("amount_toman", sa.BigInteger(), nullable=False),
        sa.Column("balance_after", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("kind", "reference_id", name="wallet_entry_reference"),
        sa.CheckConstraint("(kind IN ('topup', 'sms_refund') AND amount_toman > 0) OR "
                           "(kind = 'sms' AND amount_toman < 0)", name="wallet_entry_amount"),
        sa.CheckConstraint("balance_after >= 0", name="wallet_entry_balance"), schema="wallets")
    op.create_index("ix_wallet_entries_owner", "entries", ["user_id", "created_at", "id"], schema="wallets")
    op.create_table("topups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("wallets.accounts.user_id"), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("amount_toman", sa.BigInteger(), nullable=False),
        sa.Column("authority", sa.String(64), nullable=False, unique=True),
        sa.Column("reference", sa.String(64), unique=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "request_id", name="wallet_topup_request"),
        sa.CheckConstraint("amount_toman BETWEEN 10000 AND 10000000", name="wallet_topup_amount"),
        sa.CheckConstraint("status IN ('pending', 'paid')", name="wallet_topup_status"), schema="wallets")
    op.create_index("ix_wallet_topups_owner", "topups", ["user_id", "created_at", "id"], schema="wallets")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM wallets.accounts WHERE balance_toman <> 0) "
                                   "OR EXISTS (SELECT 1 FROM wallets.entries) "
                                   "OR EXISTS (SELECT 1 FROM wallets.topups)")):
        raise RuntimeError("Export and explicitly clear wallet balances and financial records before downgrading.")
    op.drop_table("topups", schema="wallets")
    op.drop_table("entries", schema="wallets")
    op.drop_table("accounts", schema="wallets")
    op.execute("DROP SCHEMA wallets")
