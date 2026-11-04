from app.expenses.models import ExpenseEntry

SCHEMA = "expenses"
TABLES = (ExpenseEntry.__table__,)
