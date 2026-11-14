from app.wallets.models import Entry, Topup, Wallet

SCHEMA = "wallets"
TABLES = (Wallet.__table__, Entry.__table__, Topup.__table__)
