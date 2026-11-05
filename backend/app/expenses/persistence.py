from app.expenses.models import ExpenseCategory, ExpenseEntry

SCHEMA = "expenses"
TABLES = (ExpenseEntry.__table__, ExpenseCategory.__table__)
