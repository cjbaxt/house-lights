from typing import Optional, List
from datetime import date, datetime, time as time_type
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Time
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pgvector.sqlalchemy import Vector
import uuid


class Venue(SQLModel, table=True):
    __tablename__ = "venue"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    city: str = "Amsterdam"
    website_url: Optional[str] = None
    scrape_url: Optional[str] = None
    scraper_key: Optional[str] = None
    priority: str = "medium"  # high / medium / low
    active: bool = True
    # enrichment fields
    address: Optional[str] = None
    neighbourhood: Optional[str] = None
    # theatre / concert_hall / arena / gallery / pub / outdoor / other
    venue_type: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class Company(SQLModel, table=True):
    """Theatre/production companies tracked by their own site rather than a venue."""
    __tablename__ = "company"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    website_url: Optional[str] = None
    scrape_url: Optional[str] = None
    scraper_key: Optional[str] = None
    priority: str = "medium"
    active: bool = True
    description: Optional[str] = None
    image_url: Optional[str] = None


class Show(SQLModel, table=True):
    __tablename__ = "show"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str
    subtitle: Optional[str] = None
    venue_id: Optional[uuid.UUID] = Field(default=None, foreign_key="venue.id")
    company_id: Optional[uuid.UUID] = Field(default=None, foreign_key="company.id")
    date: date
    time: Optional[time_type] = Field(default=None, sa_column=Column(Time, nullable=True))
    end_time: Optional[time_type] = Field(default=None, sa_column=Column(Time, nullable=True))
    # music / classical / opera / ballet / dance / theatre / cabaret / comedy / spoken_word / other
    type: Optional[str] = None
    url: Optional[str] = None  # link to ticket/event page
    ticket_status: Optional[str] = None  # available / sold_out / few_left / unknown
    price_from: Optional[float] = None
    currency: str = "EUR"
    description: Optional[str] = None
    summary: Optional[str] = None
    image_url: Optional[str] = None
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(1024), nullable=True), exclude=True)
    scraped_at: datetime = Field(default_factory=datetime.utcnow)
    # dedup key — scraper sets this to avoid inserting duplicates
    source_id: Optional[str] = None


class Watchlist(SQLModel, table=True):
    __tablename__ = "watchlist"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    show_id: uuid.UUID = Field(foreign_key="show.id")
    # interested / tickets_bought / waitlisting / maybe / passed
    status: str = "interested"
    notes: Optional[str] = None
    added_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
