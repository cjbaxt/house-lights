#!/usr/bin/env python3
"""
Dump the house_lights Postgres DB to static JSON files for GitHub Pages.

  python scripts/dump_to_json.py

Outputs to frontend/public/data/:
  shows.json       — all upcoming shows (ordered by date)
  venues.json      — all active venues
  companies.json   — all active companies
"""
import json
import sys
import os
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

from sqlmodel import Session, create_engine, select
from app.models.core import Show, Venue, Company, Watchlist

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://clairebaxter@localhost:5432/house_lights"
)

OUT = Path(__file__).parent.parent / "frontend" / "public" / "data"


def write(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, default=str, ensure_ascii=False, indent=None),
        encoding="utf-8",
    )
    print(f"  wrote {path.relative_to(OUT.parent.parent)} ({len(data) if isinstance(data, list) else 1} items)")


def model_dict(obj) -> dict:
    return {c: getattr(obj, c) for c in obj.__class__.model_fields}


def main():
    engine = create_engine(DATABASE_URL)
    today = date.today()

    with Session(engine) as session:
        print("Shows...")
        shows = session.exec(
            select(Show)
            .where(Show.date >= today)
            .order_by(Show.date, Show.time)
        ).all()
        write(OUT / "shows.json", [model_dict(s) for s in shows])

        print("Venues...")
        venues = session.exec(
            select(Venue).where(Venue.active == True).order_by(Venue.priority, Venue.name)
        ).all()
        write(OUT / "venues.json", [model_dict(v) for v in venues])

        print("Companies...")
        companies = session.exec(
            select(Company).where(Company.active == True).order_by(Company.priority, Company.name)
        ).all()
        write(OUT / "companies.json", [model_dict(c) for c in companies])

        print("Watchlist...")
        watchlist_entries = session.exec(select(Watchlist)).all()
        show_map = {s.id: s for s in shows}
        watchlist_out = []
        for w in watchlist_entries:
            show = show_map.get(w.show_id)
            if show:
                watchlist_out.append({
                    "watchlist": model_dict(w),
                    "show": model_dict(show),
                })
        write(OUT / "watchlist.json", watchlist_out)

    print(f"\nDone. {len(shows)} shows, {len(venues)} venues, {len(companies)} companies, {len(watchlist_out)} watchlist entries.")


if __name__ == "__main__":
    main()
