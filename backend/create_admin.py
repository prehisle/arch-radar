from sqlmodel import Session, select
from backend.database import engine
from backend.models import AdminUser
from backend.auth import get_password_hash
from backend.config import settings
import sys

def create_admin(username, password):
    with Session(engine) as session:
        # Check if exists
        user = session.exec(select(AdminUser).where(AdminUser.username == username)).first()
        if user:
            print(f"User {username} already exists.")
            return

        hashed_password = get_password_hash(password)
        new_user = AdminUser(username=username, hashed_password=hashed_password)
        session.add(new_user)
        session.commit()
        print(f"Created admin user: {username}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python create_admin.py <username> <password>")
        # Default fallback for testing
        print("Creating default admin...")
        create_admin("admin", "admin123")
    else:
        create_admin(sys.argv[1], sys.argv[2])
