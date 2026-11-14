"""One registration gift per new user, credited to their first family."""

import sqlalchemy as sa
from alembic import op

revision = "d7c8412eab30"
down_revision = "ce965430eb12"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("signup_gifts",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("family_id", sa.Uuid(), sa.ForeignKey("wallets.accounts.family_id"), nullable=True),
        schema="wallets")
    op.drop_constraint("wallet_entry_amount", "entries", schema="wallets", type_="check")
    op.create_check_constraint("wallet_entry_amount", "entries",
        "(kind IN ('topup', 'sms_refund') AND amount_toman > 0) OR "
        "(kind = 'signup_gift' AND amount_toman = 5000) OR "
        "(kind = 'sms' AND amount_toman < 0)", schema="wallets")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM wallets.signup_gifts)")):
        raise RuntimeError("Signup gift entitlements must be preserved; restore a backup to roll back.")
    op.drop_table("signup_gifts", schema="wallets")
    op.drop_constraint("wallet_entry_amount", "entries", schema="wallets", type_="check")
    op.create_check_constraint("wallet_entry_amount", "entries",
        "(kind IN ('topup', 'sms_refund') AND amount_toman > 0) OR "
        "(kind = 'sms' AND amount_toman < 0)", schema="wallets")
