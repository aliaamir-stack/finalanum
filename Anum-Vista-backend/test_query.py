import sys
from backend.database import SessionLocal
from backend import models
from sqlalchemy import func

db = SessionLocal()
import datetime
period = datetime.date(2026, 5, 1)

latest_period = db.query(func.max(models.FundsInHandEntry.period)).filter(models.FundsInHandEntry.period < period).scalar()
print("Latest period <", period, ":", latest_period)
if latest_period:
    previous_entries = db.query(models.FundsInHandEntry).filter(models.FundsInHandEntry.period == latest_period).all()
    for prev in previous_entries:
        print("Prev:", prev.person, prev.amount)
