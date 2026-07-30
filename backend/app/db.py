import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

# SQLAlchemy requires the dialect+driver form; normalise bare postgres:// URLs
_url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if _url.startswith("postgresql://") and "+psycopg2" not in _url and "+psycopg" not in _url:
    _url = _url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(_url, echo=False)


def get_session():
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
