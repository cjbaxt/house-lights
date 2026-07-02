from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlmodel import Session, select
from icalendar import Calendar, Event as CalEvent
from app.db import get_session
from app.models.core import Watchlist, Show, Venue, Company
import uuid

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/watchlist.ics", response_class=Response)
def export_watchlist_ical(session: Session = Depends(get_session)):
    rows = session.exec(
        select(Watchlist, Show).join(Show, Watchlist.show_id == Show.id).order_by(Show.date)
    ).all()

    cal = Calendar()
    cal.add("prodid", "-//house-lights//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", "house-lights watchlist")

    for watchlist, show in rows:
        if watchlist.status == "passed":
            continue

        ev = CalEvent()
        ev.add("uid", str(show.id))
        ev.add("summary", show.title)

        if show.time:
            dt_start = datetime.combine(show.date, show.time).replace(tzinfo=timezone.utc)
            ev.add("dtstart", dt_start)
            if show.end_time:
                ev.add("dtend", datetime.combine(show.date, show.end_time).replace(tzinfo=timezone.utc))
        else:
            ev.add("dtstart", show.date)

        parts = []
        if watchlist.status:
            parts.append(f"Status: {watchlist.status.replace('_', ' ').title()}")
        if show.ticket_status:
            parts.append(f"Tickets: {show.ticket_status.replace('_', ' ')}")
        if show.url:
            parts.append(show.url)
        if watchlist.notes:
            parts.append(watchlist.notes)
        if parts:
            ev.add("description", "\n".join(parts))

        if show.url:
            ev.add("url", show.url)

        cal.add_component(ev)

    return Response(
        content=cal.to_ical(),
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=watchlist.ics"},
    )
