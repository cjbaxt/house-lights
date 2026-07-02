from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.db import get_session
from app.models.core import Show, Watchlist

router = APIRouter(prefix="/shows", tags=["shows"])


@router.get("/")
def list_shows(
    venue_id: Optional[str] = None,
    company_id: Optional[str] = None,
    from_date: Optional[str] = None,
    session: Session = Depends(get_session),
):
    stmt = select(Show).order_by(Show.date, Show.time)
    if venue_id:
        stmt = stmt.where(Show.venue_id == venue_id)
    if company_id:
        stmt = stmt.where(Show.company_id == company_id)
    return session.exec(stmt).all()


@router.get("/upcoming")
def upcoming_shows(
    limit: int = Query(default=100, le=5000),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
):
    from datetime import date, datetime, time as time_type
    from sqlalchemy import or_, and_, text
    now = datetime.now()
    today = now.date()
    now_time = now.time()
    stmt = (
        select(Show)
        .where(
            or_(
                Show.date > today,
                and_(
                    Show.date == today,
                    or_(
                        Show.time == None,
                        Show.time >= now_time,
                    )
                )
            )
        )
        .order_by(Show.date, Show.time)
        .offset(offset)
        .limit(limit)
    )
    return session.exec(stmt).all()
