import os
from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from backend.config import MACAI_DB_PATH
from backend.models import Base

db_file = Path(MACAI_DB_PATH)
db_file.parent.mkdir(parents=True, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{MACAI_DB_PATH}"

# Check_same_thread=False is safe with SQLite when sessions are scoped per request
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Enable WAL mode and foreign keys in SQLite for robust concurrency and referential integrity
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN occurrence_count INTEGER DEFAULT 1;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN last_seen_at DATETIME;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN acknowledged_at DATETIME;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN acknowledged_by VARCHAR(255);"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN resolved_by VARCHAR(255);"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN resolution_note TEXT;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE hosts ADD COLUMN disk_health_json TEXT;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE hosts ADD COLUMN system_resources_json TEXT;"))
            conn.commit()
        except Exception:
            pass



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
