"""
Generates embeddings for shows using mxbai-embed-large.
Re-run with --all to re-embed everything (e.g. after switching models).
Run: python enrich_embeddings.py [--all]
"""
import sys
import html
import re
import uuid
import ollama
from sqlmodel import Session, select, text
from app.db import engine
from app.models.core import Show, Venue, Company

BATCH_SIZE = 50
MODEL = "mxbai-embed-large"
DOC_PREFIX = "Represent this sentence for searching relevant passages: "

# Short genre/context profiles per venue and company key.
# These disambiguate shows whose descriptions mention tangential genres
# (e.g. Muziekgebouw describing a ballet-inspired composition as "dance music").
VENUE_PROFILES: dict[str, str] = {
    "muziekgebouw":     "This is a music concert performance, not a dance or ballet show. Muziekgebouw is a contemporary classical and experimental music concert hall. All performances here are concerts.",
    "concertgebouw":    "This is an orchestral or chamber music concert, not a dance or theatre show. The Royal Concertgebouw is a classical music concert hall.",
    "bimhuis":          "This is a jazz or improvised music concert. Bimhuis is Amsterdam's premier jazz and avant-garde music venue.",
    "operaballet":      "This is an opera or classical ballet stage production at the Nationale Opera & Ballet.",
    "melkweg":          "pop, rock, electronic, hip-hop, and club nights",
    "paradiso":         "pop, rock, and alternative music venue",
    "afaslive":         "large pop and rock concert venue, occasional comedy",
    "ziggodome":        "large arena pop and rock concerts",
    "ita":              "international contemporary theatre and drama",
    "frascati":         "contemporary theatre, dance, and performance art",
    "delamar":          "Dutch-language musical theatre and cabaret",
    "carre":            "large-scale musical theatre, circus, and variety",
    "meervaart":        "multicultural theatre, comedy, and performing arts",
    "felixmeritis":     "debate, culture, and performing arts venue",
    "boomchicago":      "English-language improv and stand-up comedy",
    "cinetol":          "film screenings and cinema events",
    "shelter":          "underground electronic and dance music club",
    "ot301":            "alternative, underground, and experimental arts venue",
    "badhuistheater":   "intimate fringe theatre and new writing",
    "bostheater":       "outdoor theatre in the Vondelpark",
    "downstageleft":    "English-language comedy and improv theatre",
    "englishtheatrenetherlands": "English-language drama and contemporary theatre",
    "inplayers":        "English-language musical theatre and drama",
    "otc":              "English-language community and fringe theatre",
    "cauldron":         "English-language comedy and improv shows",
    "hea":              "English-language theatre productions",
}


# For these music-only venues, strip dance/ballet/theatre genre words from
# descriptions — they always refer to source material, not the performance type.
STRIP_DANCE_WORDS = {"muziekgebouw", "concertgebouw", "bimhuis"}
_DANCE_TERMS = re.compile(r"\b(ballet|dans\w*|dance|choreograph\w*|danser\w*)\b", re.I)


def clean(text: str) -> str:
    return html.unescape(text).strip()


def build_text(show: Show, venue_profile: str | None, scraper_key: str | None) -> str:
    parts = [clean(show.title)]
    if show.subtitle:
        parts.append(clean(show.subtitle))
    if show.type:
        parts.append(show.type)
    if show.description:
        desc = clean(show.description)[:1000]
        if scraper_key in STRIP_DANCE_WORDS:
            desc = _DANCE_TERMS.sub("", desc)
        parts.append(desc)
    if venue_profile:
        parts.append(venue_profile)
        parts.append(venue_profile)
    return " | ".join(parts)


def embed_document(text: str) -> list[float]:
    resp = ollama.embeddings(model=MODEL, prompt=DOC_PREFIX + text)
    return resp["embedding"]


def main():
    reembed_all = "--all" in sys.argv

    with Session(engine) as session:
        # Build venue/company key lookups
        venues = {str(v.id): v.scraper_key for v in session.exec(select(Venue)).all()}
        companies = {str(c.id): c.scraper_key for c in session.exec(select(Company)).all()}

        if reembed_all:
            shows = session.exec(select(Show).where(Show.description != None)).all()
        else:
            shows = session.exec(
                select(Show).where(Show.embedding == None, Show.description != None)
            ).all()

    print(f"Shows to embed: {len(shows)}")
    if not shows:
        print("Nothing to do.")
        return

    updated = 0
    with Session(engine) as session:
        for show in shows:
            scraper_key = venues.get(str(show.venue_id)) or companies.get(str(show.company_id))
            venue_profile = VENUE_PROFILES.get(scraper_key) if scraper_key else None
            text_str = build_text(show, venue_profile, scraper_key)
            try:
                vec = embed_document(text_str)
            except Exception as e:
                print(f"  skip {show.title[:40]}: {e}")
                continue

            db_show = session.get(Show, show.id)
            if db_show:
                db_show.embedding = vec
                session.add(db_show)
                updated += 1

            if updated % BATCH_SIZE == 0:
                session.commit()
                print(f"  {updated}/{len(shows)} embedded...")

        session.commit()

    print(f"Done. Embedded {updated} shows.")


if __name__ == "__main__":
    main()
