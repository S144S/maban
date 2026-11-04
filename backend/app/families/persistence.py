from app.families.models import Family, Invitation, Membership

SCHEMA = "families"
TABLES = tuple(model.__table__ for model in (Family, Membership, Invitation))
