from sqlmodel import SQLModel, create_engine, Session, select
from backend.config import settings
import redis
import pymysql  # Explicitly import pymysql for SQLAlchemy MySQL driver

# MySQL connection
# Ensure pymysql is installed and available as MySQL driver
engine = create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)

# Redis connection
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

def create_db_and_tables():
    try:
        SQLModel.metadata.create_all(engine)
        
        # Initialize default config if not exists
        from backend.models import AIConfig
        with Session(engine) as session:
            # Report Prompt
            if not session.get(AIConfig, 1):
                # We use ID 1 and 2 for simplicity, or check by key
                report_conf = session.exec(select(AIConfig).where(AIConfig.config_key == "prompt_report")).first()
                if not report_conf:
                    session.add(AIConfig(config_key="prompt_report", value=settings.DEFAULT_PROMPT_REPORT))
                
                share_conf = session.exec(select(AIConfig).where(AIConfig.config_key == "prompt_share")).first()
                if not share_conf:
                    session.add(AIConfig(config_key="prompt_share", value=settings.DEFAULT_PROMPT_SHARE))
                
                session.commit()
                
    except Exception as e:
        print(f"Error creating tables: {e}")
        print("Please ensure MySQL is running and the database exists.")

def get_session():
    with Session(engine) as session:
        yield session
