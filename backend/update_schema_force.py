from sqlmodel import SQLModel, text
from backend.database import engine
from backend.models import AdminUser

def update_schema():
    print("Updating schema...")
    # SQLModel create_all only creates *missing* tables, it doesn't migrate columns.
    # Since we added AdminUser and modified AIConfig, and we are in dev/prototype mode:
    # We will attempt to drop the tables if they exist and re-create them.
    # WARNING: DATA LOSS on these tables.
    
    with engine.connect() as conn:
        try:
            print("Dropping AdminUser table if exists...")
            conn.execute(text("DROP TABLE IF EXISTS adminuser"))
            print("Dropping AIConfig table if exists...")
            conn.execute(text("DROP TABLE IF EXISTS aiconfig"))
            conn.commit()
        except Exception as e:
            print(f"Error dropping tables: {e}")
            
    print("Creating tables...")
    SQLModel.metadata.create_all(engine)
    print("Done.")

if __name__ == "__main__":
    update_schema()
