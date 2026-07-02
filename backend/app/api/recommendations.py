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
    ids_list = ", ".join("'" + sid + "'" for sid in exclude_ids)
    exclude_clause = f"AND id NOT IN ({ids_list})" if exclude_ids else ""
    rows = session.exec(text(f"""
        SELECT id, title, subtitle, venue_id, company_id, date, time,
               type, url, ticket_status, price_from, currency,
               description, image_url,
               1 - (embedding <=> '{vec}'::vector) AS score
        FROM show
        WHERE date >= '{today}'
          AND embedding IS NOT NULL
          {exclude_clause}
        ORDER BY embedding <=> '{vec}'::vector
        LIMIT {limit}
    """)).all()
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
    ids_sql = ", ".join(f"'{sid}'" for sid in watched_ids)

    avg = session.exec(text(f"""
        SELECT avg(embedding) FROM show
        WHERE id IN ({ids_sql}) AND embedding IS NOT NULL
    """)).one()

    if avg[0] is None:
        return []

    return _search(avg[0], watched_ids, limit, session)
