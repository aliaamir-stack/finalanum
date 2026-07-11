"""
seed_users.py — Create hardcoded admin and super-admin accounts.
Run once:  python seed_users.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine, Base
import models
from auth import hash_password

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        accounts = [
            {"username": "admin", "email": "admin@anumvista.com", "password": "admin123", "role": models.UserRole.admin},
            {"username": "superadmin", "email": "superadmin@anumvista.com", "password": "super123", "role": models.UserRole.super_admin},
        ]
        for acct in accounts:
            existing = db.query(models.User).filter(models.User.username == acct["username"]).first()
            if existing:
                print(f"  ✓ User '{acct['username']}' already exists (id={existing.id})")
                continue
            user = models.User(
                username=acct["username"],
                email=acct["email"],
                hashed_password=hash_password(acct["password"]),
                role=acct["role"],
            )
            db.add(user)
            db.flush()
            print(f"  ✓ Created user '{acct['username']}' (role={acct['role'].value}, id={user.id})")
        db.commit()
        print("\nDone. Users seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
