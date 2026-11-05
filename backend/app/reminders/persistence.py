from app.reminders.models import Reminder, SmsAttempt

SCHEMA = "reminders"
TABLES = (Reminder.__table__, SmsAttempt.__table__)
