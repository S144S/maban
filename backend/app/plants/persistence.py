from app.plants.models import CareEvent, Plant

SCHEMA = "plants"
TABLES = (Plant.__table__, CareEvent.__table__)
