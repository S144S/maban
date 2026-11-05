"""Owner-scoped valuation history, seeded only at migration time."""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "ef032198c4d5"
down_revision = "def21097b3c4"
branch_labels = None
depends_on = None


def upgrade():
    for schema in ("investments", "assets"):
        op.create_table("valuation_history",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("holdings", postgresql.JSONB(), nullable=False), schema=schema)
        op.create_index("ix_" + schema + "_valuation_history_user_id", "valuation_history", ["user_id"], schema=schema)
    op.execute("""
        INSERT INTO investments.valuation_history (user_id, recorded_at, holdings)
        SELECT e.user_id, clock_timestamp(), jsonb_agg(jsonb_build_object(
            'id', e.id::text, 'kind', e.kind, 'label', coalesce(e.symbol, e.kind),
            'quantity', coalesce(e.shares::numeric, e.grams, e.quantity)::text,
            'price', r.unit_price_toman::text) ORDER BY e.id)
        FROM investments.entries e LEFT JOIN investments.rates r
        ON e.user_id=r.user_id AND e.kind=r.kind AND coalesce(e.symbol, '')=r.symbol
        GROUP BY e.user_id
    """)
    op.execute("""
        INSERT INTO assets.valuation_history (user_id, recorded_at, holdings)
        SELECT user_id, clock_timestamp(), jsonb_agg(jsonb_build_object(
            'id', id::text, 'kind', kind, 'label', CASE WHEN kind='car' THEN model ELSE title END,
            'quantity', CASE WHEN kind='car' THEN '1' ELSE area_sqm::text END,
            'price', current_unit_price_toman::text) ORDER BY id)
        FROM assets.entries GROUP BY user_id
    """)


def downgrade():
    for schema in ("investments", "assets"):
        if op.get_bind().scalar(sa.text(f"SELECT EXISTS (SELECT 1 FROM {schema}.valuation_history)")):
            raise RuntimeError("Export and explicitly clear valuation history before downgrading.")
    for schema in ("investments", "assets"):
        op.drop_table("valuation_history", schema=schema)
