from app.assets.models import Asset, AssetSnapshot

SCHEMA = "assets"
TABLES = (AssetSnapshot.__table__, Asset.__table__,)
