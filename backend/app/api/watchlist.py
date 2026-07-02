from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from app.db import get_session
from app.models.core import Watchlist, Show

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistUpsert(BaseModel):
    show_id: str
    status: str = "interested"
    notes: str | None = None


@router.get("/")
def get_watchlist(session: Session = Depends(get_session)):
    stmt = select(Watchlist, Show).join(Show, Watchlist.show_id == Show.id).order_by(Show.date)
    rows = session.exec(stmt).all()
    return [{"watchlist": w.model_dump(), "show": s.model_dump()} for w, s in rows]


@router.put("/{show_id}")
def upsert_watchlist(show_id: str, body: WatchlistUpsert, session: Session = Depends(get_session)):
    import uuid
    existing = session.exec(select(Watchlist).where(Watchlist.show_id == uuid.UUID(show_id))).first()
    if existing:
        existing.status = body.status
        existing.notes = body.notes
        existing.updated_at = datetime.utcnow()
        session.add(existing)
    else:
        entry = Watchlist(show_id=uuid.UUID(show_id), status=body.status, notes=body.notes)
        session.add(entry)
    session.commit()
    return {"ok": True}


@router.delete("/{show_id}")
def remove_watchlist(show_id: str, session: Session = Depends(get_session)):
    import uuid
    entry = session.exec(select(Watchlist).where(Watchlist.show_id == uuid.UUID(show_id))).first()
    if not entry:
        raise HTTPException(404, "Not on watchlist")
    session.delete(entry)
    session.commit()
    return {"ok": True}
