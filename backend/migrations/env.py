from alembic import context

from app.config import Settings
from app.database import Base, database
from app.expenses.persistence import SCHEMA as EXPENSES_SCHEMA
from app.families.persistence import SCHEMA as FAMILY_SCHEMA
from app.income.persistence import SCHEMA as INCOME_SCHEMA
from app.money_locations.persistence import SCHEMA as LOCATIONS_SCHEMA
from app.users.persistence import SCHEMA, TABLES  # noqa: F401

engine, _ = database(Settings().database_url)
with engine.connect() as connection:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        compare_type=True,
        include_schemas=True,
        include_name=lambda name, kind, parent: (
            kind != "schema" or name in (None, SCHEMA, FAMILY_SCHEMA, INCOME_SCHEMA, EXPENSES_SCHEMA, LOCATIONS_SCHEMA)
        ),
    )
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
