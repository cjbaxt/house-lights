"""
Melkweg scraper — static HTML agenda page.
URL pattern: /nl/agenda/title-DD-MM-YYYY/
Date embedded in the slug and in the page HTML.
"""
import httpx
import re
import asyncio
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.melkweg.nl/nl/agenda/"
BASE_URL = "https://www.melkweg.nl"

# Dutch month names used in the slug dates aren't needed — date is in the URL path
SLUG_DATE_RE = re.compile(r"-(\d{2})-(\d{2})-(\d{4})/?$")
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def _parse_date_from_url(url: str) -> date | None:
    m = SLUG_DATE_RE.search(url)
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


def _parse_time(text: str):
    m = TIME_RE.search(text)
    if not m:
        return None
    try:
        from datetime import time
        return time(int(m.group(1)), int(m.group(2)))
    except ValueError:
        return None


class MelkwegScraper(BaseScraper):
    key = "melkweg"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers={"Accept-Language": "nl"}) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []

            for link in soup.select("a[href*='/nl/agenda/']"):
                href = link.get("href", "")
                if not SLUG_DATE_RE.search(href):
                    continue

                event_date = _parse_date_from_url(href)
                if not event_date:
                    continue

                # Skip past dates
                if event_date < date.today():
                    continue

                url = BASE_URL + href if href.startswith("/") else href

                # Title: look for heading or strong text inside the link
                title_el = link.select_one("h2, h3, h4, strong, .title, [class*='title']")
                title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
                title = re.sub(r"\s+", " ", title).strip()
                if not title or len(title) < 2:
                    continue

                # Genre / subtitle — skip tag strings (·-separated genres)
                genre_el = link.select_one("[class*='genre'], [class*='tag'], [class*='category'], em")
                raw_subtitle = genre_el.get_text(strip=True) if genre_el else None
                subtitle = None if (raw_subtitle and "·" in raw_subtitle) else raw_subtitle

                # Time from listing card — try parent container first since time element
                # may be a sibling of the <a> tag, not inside it
                container_text = (link.parent or link).get_text(" ", strip=True)
                tm = _parse_time(container_text)

                sold_out = "uitverkocht" in container_text.lower() or "sold out" in container_text.lower()
                ticket_status = "sold_out" if sold_out else "available"

                img_el = link.select_one("img")
                image_url = img_el.get("src") if img_el else None

                items.append({
                    "title": title, "subtitle": subtitle, "date": event_date,
                    "time": tm, "url": url, "href": href, "ticket_status": ticket_status,
                    "image_url": image_url,
                })

            # Deduplicate by source_id
            seen = set()
            unique_items = []
            for it in items:
                sid = f"melkweg:{it['href']}"
                if sid not in seen:
                    seen.add(sid)
                    unique_items.append(it)

            # Fetch descriptions, og:image, and time from detail pages in parallel
            async def fetch_desc(url: str) -> tuple[str, str | None, str | None, object]:
                try:
                    r = await client.get(url, timeout=15)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        og_img = ds.select_one('meta[property="og:image"]')
                        img = og_img.get("content", "").strip() if og_img else None
                        # Time: look for <time> elements or "Aanvang"/"Doors" text
                        detail_time = None
                        time_el = ds.select_one("time[datetime]")
                        if time_el:
                            detail_time = _parse_time(time_el.get("datetime", "") + " " + time_el.get_text())
                        if not detail_time:
                            for label in ["aanvang", "doors", "start", "aanvang:"]:
                                for el in ds.find_all(string=re.compile(label, re.I)):
                                    detail_time = _parse_time(str(el.parent.get_text(" ", strip=True)))
                                    if detail_time:
                                        break
                                if detail_time:
                                    break
                        meta = ds.select_one('meta[property="og:description"], meta[name="description"]')
                        if meta:
                            desc = meta.get("content", "").strip()
                            if desc:
                                return url, desc, img, detail_time
                        el = ds.select_one(".event-description, .description, .content, main p")
                        if el:
                            text = el.get_text(" ", strip=True)[:1000]
                            if text:
                                return url, text, img, detail_time
                        return url, None, img, detail_time
                except Exception:
                    pass
                return url, None, None, None

            unique_urls = list({it["url"] for it in unique_items})
            detail_results = await asyncio.gather(*[fetch_desc(u) for u in unique_urls])
            descriptions = {r[0]: r[1] for r in detail_results}
            detail_images = {r[0]: r[2] for r in detail_results}
            detail_times = {r[0]: r[3] for r in detail_results}

        shows = []
        for it in unique_items:
            shows.append(ScrapedShow(
                title=it["title"],
                subtitle=it["subtitle"],
                date=it["date"],
                time=it["time"] or detail_times.get(it["url"]),
                url=it["url"],
                source_id=f"melkweg:{it['href']}",
                type="music",
                ticket_status=it["ticket_status"],
                description=descriptions.get(it["url"]),
                image_url=it.get("image_url") or detail_images.get(it["url"]),
            ))

        return shows
