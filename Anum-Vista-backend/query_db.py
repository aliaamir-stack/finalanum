from backend.database import SessionLocal
from backend import models

db = SessionLocal()
txns = db.query(models.Transaction).filter(models.Transaction.status == "approved").order_by(models.Transaction.id.desc()).limit(5).all()
for t in txns:
    print(f"ID: {t.id}, Amount: {t.amount}, Type: {t.type}, Credited To: {t.credited_to}")

funds = db.query(models.FundsInHandEntry).order_by(models.FundsInHandEntry.id.desc()).limit(10).all()
print("FundsInHandEntries:")
for f in funds:
    print(f"ID: {f.id}, Period: {f.period}, Person: {f.person}, Amount: {f.amount}")
