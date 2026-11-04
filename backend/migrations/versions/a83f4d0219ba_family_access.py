"""Add family member and invitation access levels."""

import sqlalchemy as sa
from alembic import op

revision = "a83f4d0219ba"
down_revision = "f897737fa02e"
branch_labels = None
depends_on = None


def upgrade():
    for table, name in [("memberships", "membership_access"), ("invitations", "invitation_access")]:
        op.add_column(
            table, sa.Column("access", sa.String(4), nullable=False, server_default="view"), schema="families"
        )
        op.create_check_constraint(name, table, "access IN ('full', 'view')", schema="families")
    op.execute(
        "UPDATE families.memberships m SET access = 'full' FROM families.families f WHERE m.family_id = f.id AND m.user_id = f.owner_id"
    )


def downgrade():
    for table, name in [("invitations", "invitation_access"), ("memberships", "membership_access")]:
        op.drop_constraint(name, table, schema="families", type_="check")
        op.drop_column(table, "access", schema="families")
