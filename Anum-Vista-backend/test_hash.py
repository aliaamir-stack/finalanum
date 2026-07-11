from backend.database import SessionLocal
from backend.models import User
from backend.auth import verify_password

db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f"User: {u.username}, Hash: {u.hashed_password}")
    if u.username == 'admin':
        result = verify_password('admin123', u.hashed_password)
        print(f"admin123 match: {result}")
    if u.username == 'superadmin':
        result = verify_password('super123', u.hashed_password)
        print(f"super123 match: {result}")
