"""
Fetches og:image for shows that have a URL but no image_url.
Run after scraping: python enrich_images.py

Uses async httpx with a concurrency limit to avoid hammering sites.
"""
import asyncio
import re
import httpx
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Show

CONCURRENCY = 10
TIMEOUT = 15
OG_IMAGE_RE = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.I,
)
# Also match content-first ordering
OG_IMAGE_RE2 = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    re.I,
)


async def fetch_og_image(client: httpx.AsyncClient, show_id, url: str) -> tuple:
    try:
        r = await client.get(url, timeout=TIMEOUT, follow_redirects=True)
        html = r.text[:50_000]  # only need the <head>
        for pattern in [OG_IMAGE_RE, OG_IMAGE_RE2]:
            m = pattern.search(html)
            if m:
                return show_id, m.group(1).strip()
    except Exception:
        pass
    return show_id, None


async def main():
    with Session(engine) as session:
        shows = session.exec(
            select(Show).where(Show.image_url == None, Show.url != None)
        ).all()

    print(f"Shows missing image: {len(shows)}")
    if not shows:
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    results: dict = {}

    async def bounded(client, show):
        async with semaphore:
            sid, img = await fetch_og_image(client, show.id, show.url)
            if img:
                results[sid] = img

    headers = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-bot/1.0)"}
    async with httpx.AsyncClient(headers=headers) as client:
        await asyncio.gather(*[bounded(client, s) for s in shows])

    print(f"Found images for {len(results)}/{len(shows)} shows")

    with Session(engine) as session:
        for show_id, image_url in results.items():
            show = session.get(Show, show_id)
            if show:
                show.image_url = image_url
                session.add(show)
        session.commit()

    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
