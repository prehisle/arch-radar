from sqlmodel import SQLModel
from backend.database import engine
from backend.models import AdminUser

def update_schema():
    print("Creating/Updating tables...")
    SQLModel.metadata.create_all(engine)
    print("Done.")

if __name__ == "__main__":
    update_schema()
