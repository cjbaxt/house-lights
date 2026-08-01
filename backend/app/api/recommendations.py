"""
GET /api/shows/recommended        — based on watchlist
GET /api/shows/recommended?q=...  — based on freeform mood text
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, text
from app.db import get_session
from app.models.core import Show, Watchlist

router = APIRouter(prefix="/shows", tags=["shows"])

MODEL = "mxbai-embed-large"
# mxbai uses a different prefix for queries vs documents
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


def _embed(query: str) -> list[float]:
    import ollama
    resp = ollama.embeddings(model=MODEL, prompt=QUERY_PREFIX + query)
    return resp["embedding"]


def _search(vec: list[float], exclude_ids: list[str], limit: int, session: Session):
    today = date.today().isoformat()
    vec_str = str(vec)
    if exclude_ids:
        rows = session.exec(text("""
            SELECT id, title, subtitle, venue_id, company_id, date, time,
                   type, url, ticket_status, price_from, currency,
                   description, image_url,
                   1 - (embedding <=> CAST(:vec AS vector)) AS score
            FROM show
            WHERE date >= :today
              AND embedding IS NOT NULL
              AND id != ALL(CAST(:exclude AS uuid[]))
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :limit
        """), {"vec": vec_str, "today": today, "exclude": exclude_ids, "limit": limit}).all()
    else:
        rows = session.exec(text("""
            SELECT id, title, subtitle, venue_id, company_id, date, time,
                   type, url, ticket_status, price_from, currency,
                   description, image_url,
                   1 - (embedding <=> CAST(:vec AS vector)) AS score
            FROM show
            WHERE date >= :today
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :limit
        """), {"vec": vec_str, "today": today, "limit": limit}).all()
    return [dict(r._mapping) for r in rows]


@router.get("/recommended")
def recommended_shows(
    q: Optional[str] = None,
    limit: int = 20,
    session: Session = Depends(get_session),
):
    if q:
        # Mood / freeform query
        try:
            vec = _embed(q)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Ollama unavailable: {e}")
        return _search(vec, [], limit, session)

    # Watchlist-based
    watchlist = session.exec(select(Watchlist)).all()
    if not watchlist:
        return []

    watched_ids = [str(w.show_id) for w in watchlist]

    avg = session.exec(text("""
        SELECT avg(embedding) FROM show
        WHERE id = ANY(CAST(:ids AS uuid[])) AND embedding IS NOT NULL
    """), {"ids": watched_ids}).one()

    if avg[0] is None:
        return []

    return _search(avg[0], watched_ids, limit, session)
