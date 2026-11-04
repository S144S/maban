from app.income.models import IncomeEntry

SCHEMA = "income"
TABLES = (IncomeEntry.__table__,)
