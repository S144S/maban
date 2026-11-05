from app.investments.models import Investment, InvestmentRate, InvestmentSnapshot

SCHEMA = "investments"
TABLES = (InvestmentSnapshot.__table__, Investment.__table__, InvestmentRate.__table__)
