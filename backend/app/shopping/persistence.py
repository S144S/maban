from app.shopping.models import ShoppingCheckout, ShoppingItem, ShoppingList

SCHEMA = "shopping"
TABLES = (ShoppingList.__table__, ShoppingItem.__table__, ShoppingCheckout.__table__)
