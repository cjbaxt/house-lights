"""
Royal Concertgebouw — paginated httpx scraper.
The /concerten-en-tickets page uses SSR pagination (?page=N), ~15 concerts per page, up to 34 pages.
Lunchconcerten (/lunchconcerten) is a separate static page.
Date format in article text: "ma 29 jun 2026"
"""
import logging
import re
import asyncio
import httpx
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

logger = logging.getLogger(__name__)

AGENDA_URL = "https://www.concertgebouw.nl/concerten-en-tickets"
LUNCH_URL = "https://www.concertgebouw.nl/lunchconcerten"
BASE_URL = "https://www.concertgebouw.nl"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS_NL = {"jan":1,"feb":2,"mrt":3,"apr":4,"mei":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"okt":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"\w{2}\s+(\d{1,2})\s+(\w{3})\s+(\d{4})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")
PRICE_RE = re.compile(r"v\.a\.\s*€\s*([\d,]+)")
PAGE_COUNT_RE = re.compile(r'c-pagination-page-number[^>]*>(\d+)<')


def _parse(text):
    # Use last match — "Te koop vanaf do X" appears before the real concert date
    matches = list(DATE_RE.finditer(text))
    if not matches:
        return None, None
    m = matches[-1]
    month = MONTHS_NL.get(m.group(2).lower())
    if not month:
        return None, None
    try:
        d = date(int(m.group(3)), month, int(m.group(1)))
        t = TIME_RE.search(text)
        return d, time(int(t.group(1)), int(t.group(2))) if t else (d, None)
    except ValueError:
        return None, None


def _extract_from_soup(soup, seen):
    """Extract show dicts from a BeautifulSoup page."""
    items = []
    today = date.today()

    for article in soup.select("article"):
        link_el = article.select_one("a[href*='/concerten/']")
        if not link_el:
            continue
        href = link_el.get("href", "")
        if href in seen or not href:
            continue
        seen.add(href)
        url = BASE_URL + href if href.startswith("/") else href
        text = article.get_text(" ", strip=True)
        d, tm = _parse(text)
        if not d or d < today:
            continue
        title_el = article.select_one("h2, h3, h4, strong, [class*='title']")
        title = title_el.get_text(strip=True) if title_el else re.sub(DATE_RE, "", text).strip()[:80]
        if not title:
            continue
        sold_out = "uitverkocht" in text.lower()
        price_m = PRICE_RE.search(text)
        price = float(price_m.group(1).replace(",", ".")) if price_m else None
        img_el = article.select_one("img")
        image_url = img_el.get("src") if img_el else None
        items.append({"title": title, "date": d, "time": tm, "url": url, "href": href,
                      "sold_out": sold_out, "price": price, "image_url": image_url})

    # Fallback: plain links not wrapped in article
    for link in soup.select("a[href*='/concerten/']"):
        href = link.get("href", "")
        if href in seen or not href or href.rstrip("/") in ("/concerten", "/concerten-en-tickets"):
            continue
        seen.add(href)
        url = BASE_URL + href if href.startswith("/") else href
        container = link.find_parent("li") or link.find_parent("article") or link
        text = container.get_text(" ", strip=True)
        d, tm = _parse(text)
        if not d or d < today:
            continue
        title_el = container.select_one("h2, h3, h4, [class*='title']")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            title = re.sub(r"\d{1,2}:\d{2}.*", "", link.get_text(strip=True)).strip()[:80]
        if not title:
            continue
        sold_out = "uitverkocht" in text.lower()
        price_m = PRICE_RE.search(text)
        price = float(price_m.group(1).replace(",", ".")) if price_m else None
        img_el = container.select_one("img")
        image_url = img_el.get("src") if img_el else None
        items.append({"title": title, "date": d, "time": tm, "url": url, "href": href,
                      "sold_out": sold_out, "price": price, "image_url": image_url})

    return items


class ConcertgebouwFullScraper(BaseScraper):
    key = "concertgebouw"

    async def scrape(self) -> list[ScrapedShow]:
        seen = set()
        items = []

        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            # Page 1 — also tells us total page count from pagination component
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            items.extend(_extract_from_soup(soup, seen))

            # Find highest page number from pagination
            page_numbers = [int(m) for m in PAGE_COUNT_RE.findall(resp.text) if m.isdigit()]
            total_pages = max(page_numbers) if page_numbers else 1
            logger.info("concertgebouw: %d pages detected", total_pages)

            # Fetch remaining pages concurrently (in batches to avoid hammering the server)
            async def fetch_page(page_num: int):
                try:
                    r = await client.get(f"{AGENDA_URL}?page={page_num}", timeout=30)
                    if r.status_code == 200:
                        return BeautifulSoup(r.text, "html.parser")
                except Exception as e:
                    logger.warning("concertgebouw page %d error: %s", page_num, e)
                return None

            for batch_start in range(2, total_pages + 1, 5):
                batch = range(batch_start, min(batch_start + 5, total_pages + 1))
                soups = await asyncio.gather(*[fetch_page(p) for p in batch])
                for s in soups:
                    if s:
                        items.extend(_extract_from_soup(s, seen))

            logger.info("concertgebouw: extracted %d shows from main agenda", len(items))

            # Lunchconcerten — separate static page
            try:
                resp = await client.get(LUNCH_URL)
                if resp.status_code == 200:
                    lunch_items = _extract_from_soup(BeautifulSoup(resp.text, "html.parser"), seen)
                    items.extend(lunch_items)
                    logger.info("concertgebouw: extracted %d lunchconcerts", len(lunch_items))
            except Exception as e:
                logger.warning("concertgebouw lunchconcerten error: %s", e)

            # Fetch descriptions from detail pages in parallel
            async def fetch_desc(url: str) -> tuple[str, str | None]:
                try:
                    r = await client.get(url, timeout=15)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        meta = ds.select_one('meta[property="og:description"], meta[name="description"]')
                        if meta:
                            desc = meta.get("content", "").strip()
                            if desc:
                                return url, desc
                        el = ds.select_one(".concert-description, .description, .content-body, main p")
                        if el:
                            text = el.get_text(" ", strip=True)[:1000]
                            if text:
                                return url, text
                except Exception as e:
                    logger.warning("%s desc error: %s", __name__, e)
                return url, None

            unique_urls = list({it["url"] for it in items})
            desc_results = await asyncio.gather(*[fetch_desc(u) for u in unique_urls])
            descriptions = dict(desc_results)

        return [
            ScrapedShow(
                title=it["title"], date=it["date"], time=it["time"], url=it["url"],
                source_id=f"concertgebouw:{it['href']}",
                type="classical",
                ticket_status="sold_out" if it["sold_out"] else "available",
                price_from=it["price"],
                description=descriptions.get(it["url"]),
                image_url=it.get("image_url"),
            )
            for it in items
        ]
