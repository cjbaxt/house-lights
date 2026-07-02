"""
Fetches og:description for shows that have a URL but no description.
Run after scraping: python enrich_descriptions.py
"""
import asyncio
import re
import httpx
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Show

CONCURRENCY = 10
TIMEOUT = 15
OG_DESC_RE = re.compile(
    r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
    re.I,
)
OG_DESC_RE2 = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description["\']',
    re.I,
)
META_DESC_RE = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
    re.I,
)


async def fetch_description(client: httpx.AsyncClient, show_id, url: str) -> tuple:
    try:
        r = await client.get(url, timeout=TIMEOUT, follow_redirects=True)
        html = r.text[:50_000]
        for pattern in [OG_DESC_RE, OG_DESC_RE2, META_DESC_RE]:
            m = pattern.search(html)
            if m:
                desc = m.group(1).strip()
                if len(desc) > 20:
                    return show_id, desc
    except Exception:
        pass
    return show_id, None


async def main():
    with Session(engine) as session:
        shows = session.exec(
            select(Show).where(Show.description == None, Show.url != None)
        ).all()

    print(f"Shows missing description: {len(shows)}")
    if not shows:
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    results: dict = {}

    async def bounded(client, show):
        async with semaphore:
            sid, desc = await fetch_description(client, show.id, show.url)
            if desc:
                results[sid] = desc

    headers = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-bot/1.0)"}
    async with httpx.AsyncClient(headers=headers) as client:
        await asyncio.gather(*[bounded(client, s) for s in shows])

    print(f"Found descriptions for {len(results)}/{len(shows)} shows")

    with Session(engine) as session:
        for show_id, description in results.items():
            show = session.get(Show, show_id)
            if show:
                show.description = description
                session.add(show)
        session.commit()

    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
