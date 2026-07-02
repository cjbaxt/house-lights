"""
Cinetol — Webflow-based static HTML.
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.cinetol.nl/programma"
BASE_URL = "https://www.cinetol.nl"


def _parse_date(card) -> date | None:
    year = date.today().year
    for el in card.select(".event-tag.filter.hide"):
        t = el.get_text(strip=True)
        if re.match(r"202\d", t):
            year = int(t)
            break

    header = card.select_one(".card_header .event_date-flex")
    if not header:
        return None
    nums = [el.get_text(strip=True) for el in header.children
            if hasattr(el, "get_text") and el.get_text(strip=True).isdigit()]
    if len(nums) < 2:
        return None
    day, month = int(nums[0]), int(nums[1])
    try:
        d = date(year, month, day)
        if d < date.today() and year == date.today().year:
            d = date(year + 1, month, day)
        return d
    except ValueError:
        return None


class CinetolScraper(BaseScraper):
    key = "cinetol"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen: set[str] = set()

            for card in soup.select("div.card_component"):
                link_el = next(
                    (a for a in card.find_all("a", href=True) if "/events/" in a.get("href", "")),
                    None,
                )
                if not link_el:
                    continue
                href = link_el.get("href", "")
                if href in seen:
                    continue
                seen.add(href)
                url = BASE_URL + href if href.startswith("/") else href

                d = _parse_date(card)
                if not d or d < date.today():
                    continue

                title_el = card.select_one("[fs-list-field='name']")
                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    continue

                subtitle_el = card.select_one("[fs-list-field='support']")
                subtitle = subtitle_el.get_text(strip=True) if subtitle_el else None

                img_el = card.select_one("img.card_image")
                image_url = img_el.get("src") if img_el else None

                items.append({
                    "href": href, "url": url, "title": title,
                    "subtitle": subtitle, "date": d, "image_url": image_url,
                })

            # Fetch detail pages in parallel for descriptions
            async def fetch_desc(href: str) -> tuple[str, str | None]:
                detail_url = BASE_URL + href if href.startswith("/") else href
                try:
                    r = await client.get(detail_url, timeout=20)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        el = ds.select_one(".w-richtext")
                        if el:
                            return href, el.get_text(" ", strip=True)[:1000] or None
                except Exception:
                    pass
                return href, None

            desc_results = await asyncio.gather(*[fetch_desc(it["href"]) for it in items])
            descriptions = dict(desc_results)

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"],
                subtitle=it["subtitle"],
                date=it["date"],
                url=it["url"],
                source_id=f"cinetol:{it['href']}",
                type="music",
                ticket_status="available",
                image_url=it["image_url"],
                description=descriptions.get(it["href"]),
            ))

        return shows
