"""
Orange Theatre Company — Wix-based static HTML.
Productions listed with date like "July 2, 2026" in page body text.
Only follows external ticket links (Eventbrite, Paytix, etc.) — skips
internal nav links, partner companies, addresses, and press links.
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

PROD_URL = "https://www.orangetheatrecompany.com/upcomingproductions"
BASE_URL = "https://www.orangetheatrecompany.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
           "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"(\w+)\s+(\d{1,2})(?:-\d{1,2})?,?\s+(\d{4})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")

# Only treat links to these domains as ticket links
TICKET_DOMAINS = ("eventbrite", "paytix", "weticket", "ticketmaster", "tikkie", "paylogic", "stager")

_SKIP_TEXT = {
    "tickets", "learn more", "home", "about us", "contact us",
    "upcoming productions", "past productions", "support us", "",
    "anbi", "youth theatre", "tiny theatre",
}


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None
    month = MONTHS.get(m.group(1).lower())
    if not month: return None
    try:
        return date(int(m.group(3)), month, int(m.group(2)))
    except ValueError:
        return None


def _parse_time(text):
    m = TIME_RE.search(text)
    if not m: return None
    try:
        from datetime import time
        return time(int(m.group(1)), int(m.group(2)))
    except ValueError:
        return None


def _is_ticket_link(href: str) -> bool:
    return any(d in href for d in TICKET_DOMAINS)


def _is_internal_nav(href: str) -> bool:
    """True for OTC's own pages."""
    return href.startswith(BASE_URL) or (href.startswith("/") and not href.startswith("//"))


class OTCScraper(BaseScraper):
    key = "otc"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(PROD_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []
        seen = set()

        for link in soup.select("a[href]"):
            href = link.get("href", "")
            title_text = link.get_text(strip=True)

            if title_text.lower() in _SKIP_TEXT:
                continue
            if not href.startswith("http"):
                continue
            # Must be a ticket link
            if not _is_ticket_link(href):
                continue

            # Look for a date in the surrounding block
            d = None
            tm = None
            p = link.parent
            block_text = ""
            for _ in range(8):
                if not p: break
                block_text = p.get_text(" ", strip=True)
                d = _parse(block_text)
                if d: break
                p = p.parent

            if not d or d < date.today():
                continue

            if block_text:
                tm = _parse_time(block_text)

            # Use first line of link text as title (strip "Tickets" suffix etc.)
            title = re.split(r"\s{2,}|\n|Tickets", title_text)[0].strip()
            if not title or len(title) < 3:
                continue

            key = (title.lower(), d)
            if key in seen:
                continue
            seen.add(key)

            # Description and image from the surrounding block
            description = None
            image_url = None
            if p:
                block = link.find_parent("div") or link.find_parent("section")
                if block:
                    paras = [para.get_text(" ", strip=True) for para in block.select("p") if para.get_text(strip=True)]
                    if paras:
                        description = " ".join(paras[:3])[:1000] or None
                    img_el = block.select_one("img")
                    if img_el:
                        image_url = img_el.get("src")

            shows.append(ScrapedShow(
                title=title, date=d, time=tm, url=href,
                source_id=f"otc:{href}:{d}",
                type="theatre",
                ticket_status="available",
                description=description,
                image_url=image_url,
            ))

        return shows
