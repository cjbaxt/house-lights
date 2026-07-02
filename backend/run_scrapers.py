"""
Entry point for the scrape cron job.
Run: python run_scrapers.py [--venue melkweg]
"""
import asyncio
import argparse
import os
from datetime import datetime
from dotenv import load_dotenv
from sqlmodel import Session, select
load_dotenv()
from app.db import engine
from app.models.core import Show, Venue, Company, Watchlist
from app.scrapers.melkweg import MelkwegScraper
from app.scrapers.bimhuis import BimhuisScraper
from app.scrapers.operaballet import OperaBalletScraper
from app.scrapers.concertgebouw_full import ConcertgebouwFullScraper as ConcertgebouwScraper
from app.scrapers.muziekgebouw import MuziekgebouwScraper
from app.scrapers.ita import ITAScraper
from app.scrapers.frascati import FrascatiScraper
from app.scrapers.delamar import DeLaMarScraper
from app.scrapers.meervaart import MeervaartScraper
from app.scrapers.cinetol import CinetolScraper
from app.scrapers.felixmeritis import FelixMeritisScraper
from app.scrapers.shelter import ShelterScraper
from app.scrapers.boomchicago import BoomChicagoScraper
from app.scrapers.afaslive import AFASLiveScraper
from app.scrapers.badhuistheater import BadhuistheaterScraper
from app.scrapers.englishtheatrenetherlands import EnglishTheatreNetherlandsScraper
from app.scrapers.otc import OTCScraper
from app.scrapers.hea import HEAScraper
from app.scrapers.inplayers import InPlayersScraper
from app.scrapers.cauldron import CauldronScraper
from app.scrapers.downstageleft import DownStageLeftScraper
from app.scrapers.bostheater import BostheaterScraper
from app.scrapers.birdbraintheatre import BirdbBrainTheatreScraper
from app.scrapers.carre import CarreScraper
from app.scrapers.ziggodome import ZiggoDomeScraper

# Paradiso needs Playwright — imported lazily
def _paradiso():
    from app.scrapers.paradiso import ParadisoScraper
    return ParadisoScraper

SCRAPERS = {
    "melkweg": MelkwegScraper,
    "bimhuis": BimhuisScraper,
    "operaballet": OperaBalletScraper,
    "concertgebouw": ConcertgebouwScraper,
    "muziekgebouw": MuziekgebouwScraper,
    "ita": ITAScraper,
    "frascati": FrascatiScraper,
    "delamar": DeLaMarScraper,
    "meervaart": MeervaartScraper,
    "cinetol": CinetolScraper,
    "felixmeritis": FelixMeritisScraper,
    "shelter": ShelterScraper,
    "boomchicago": BoomChicagoScraper,
    "afaslive": AFASLiveScraper,
    "badhuistheater": BadhuistheaterScraper,
    "englishtheatrenetherlands": EnglishTheatreNetherlandsScraper,
    "otc": OTCScraper,
    "hea": HEAScraper,
    "inplayers": InPlayersScraper,
    "cauldron": CauldronScraper,
    "downstageleft": DownStageLeftScraper,
    "bostheater": BostheaterScraper,
    "birdbraintheatre": BirdbBrainTheatreScraper,
    "carre": CarreScraper,
    "ziggodome": ZiggoDomeScraper,
    "paradiso": _paradiso,
}


async def run_scraper(scraper_key: str, venue_id=None, company_id=None):
    factory = SCRAPERS.get(scraper_key)
    if not factory:
        print(f"  no scraper for key: {scraper_key}")
        return 0

    cls = factory() if callable(factory) and not hasattr(factory, "key") else factory
    scraper = cls()
    print(f"  scraping {scraper_key}...")
    try:
        shows = await scraper.scrape()
    except Exception as e:
        print(f"  ERROR: {e}")
        return 0

    print(f"  found {len(shows)} shows")
    inserted = updated = removed = 0
    new_source_ids = {s.source_id for s in shows}

    with Session(engine) as session:
        # Remove shows from this venue/company that are no longer in the scraped set
        if venue_id is not None:
            old = session.exec(select(Show).where(Show.venue_id == venue_id)).all()
        else:
            old = session.exec(select(Show).where(Show.company_id == company_id)).all()
        for show in old:
            if show.source_id not in new_source_ids:
                # Remove watchlist entries first to avoid FK constraint
                wl_entries = session.exec(select(Watchlist).where(Watchlist.show_id == show.id)).all()
                for wl in wl_entries:
                    session.delete(wl)
                session.flush()
                session.delete(show)
                removed += 1

        for s in shows:
            existing = session.exec(select(Show).where(Show.source_id == s.source_id)).first()
            if existing:
                existing.title = s.title
                existing.subtitle = s.subtitle
                existing.url = s.url
                existing.time = s.time
                existing.ticket_status = s.ticket_status
                existing.image_url = s.image_url
                if s.description is not None:
                    existing.description = s.description
                existing.scraped_at = datetime.now()
                session.add(existing)
                updated += 1
            else:
                session.add(Show(
                    title=s.title, subtitle=s.subtitle,
                    venue_id=venue_id, company_id=company_id,
                    date=s.date, time=s.time,
                    type=s.type, url=s.url,
                    ticket_status=s.ticket_status,
                    price_from=s.price_from,
                    description=s.description,
                    image_url=s.image_url,
                    source_id=s.source_id,
                ))
                inserted += 1
        session.commit()

    print(f"  inserted {inserted} new, updated {updated}, removed {removed}")
    return inserted


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--venue", help="run one scraper by key")
    args = parser.parse_args()

    with Session(engine) as session:
        venues = session.exec(select(Venue).where(Venue.active == True)).all()
        companies = session.exec(select(Company).where(Company.active == True)).all()

    targets = []
    for v in venues:
        if v.scraper_key and (not args.venue or args.venue == v.scraper_key):
            targets.append((v.scraper_key, v.id, None))
    for c in companies:
        if c.scraper_key and (not args.venue or args.venue == c.scraper_key):
            targets.append((c.scraper_key, None, c.id))

    if not targets:
        print("No matching scrapers found.")
        return

    for key, vid, cid in targets:
        print(f"\n[{key}]")
        await run_scraper(key, venue_id=vid, company_id=cid)

    # Ticketmaster — standalone multi-venue scraper (runs on full scrape only)
    if not args.venue and os.environ.get("TICKETMASTER_API_KEY"):
        print("\n[ticketmaster]")
        from app.scrapers.ticketmaster import run as tm_run
        await tm_run()

    # Clean up past shows (skip if running a single venue to avoid surprise deletes)
    if not args.venue:
        with Session(engine) as session:
            yesterday = (datetime.now().date() - __import__('datetime').timedelta(days=1))
            past = session.exec(select(Show).where(Show.date < yesterday)).all()
            for show in past:
                session.delete(show)
            session.commit()
            if past:
                print(f"\nCleaned up {len(past)} past shows")

    with Session(engine) as session:
        total = session.exec(select(Show)).all()
        print(f"\nTotal shows in DB: {len(total)}")


if __name__ == "__main__":
    asyncio.run(main())
