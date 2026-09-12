"""数据库引擎与会话（SQLAlchemy 2.x，MySQL）。"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    """FastAPI 依赖：每请求一个 Session。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
