import sys
import datetime
from backend.database import SessionLocal
from backend import models
from sqlalchemy import func

db = SessionLocal()
now = datetime.datetime.utcnow()
period = datetime.date(now.year, now.month, 1)

latest_period = db.query(func.max(models.FundsInHandEntry.period)).filter(models.FundsInHandEntry.period < period).scalar()
if latest_period:
    previous_entries = db.query(models.FundsInHandEntry).filter(models.FundsInHandEntry.period == latest_period).all()
    for prev in previous_entries:
        exists = db.query(models.FundsInHandEntry).filter(models.FundsInHandEntry.period == period, models.FundsInHandEntry.person == prev.person).first()
        if not exists:
            print(f"Carrying forward {prev.person} {prev.amount}")
            db.add(models.FundsInHandEntry(period=period, person=prev.person, amount=prev.amount))
    db.commit()
print("Fixed missing entries")
