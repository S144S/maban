from app.reminders.models import Reminder

SCHEMA = "reminders"
TABLES = (Reminder.__table__,)
