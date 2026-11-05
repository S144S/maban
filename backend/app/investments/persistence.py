from app.investments.models import Investment, InvestmentRate

SCHEMA = "investments"
TABLES = (Investment.__table__, InvestmentRate.__table__)
