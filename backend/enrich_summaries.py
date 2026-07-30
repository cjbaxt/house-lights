"""
Generates one-sentence AI summaries for shows using Groq (free tier).
Run: python enrich_summaries.py [--all]

Requires GROQ_API_KEY env var — get a free key at console.groq.com
"""
import sys
import html
import os
import httpx
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Show

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"

BATCH_SIZE = 20

PROMPT_TEMPLATE = """Write a single sentence (max 20 words) describing this event for someone deciding whether to go.
Be specific and vivid. No filler phrases like "Don't miss" or "An unmissable". No trailing punctuation needed.

Title: {title}
Type: {type}
Description: {description}

One sentence:"""

PROMPT_TEMPLATE_NO_DESC = """Write a single sentence (max 20 words) about the artist or act "{title}" — what kind of music or performance they are known for.
Be specific. No filler phrases like "Don't miss" or "An unmissable". No trailing punctuation needed.
If you don't recognise the name, write exactly: UNKNOWN

One sentence:"""

# Boilerplate patterns that indicate a non-description scraped from a listing page
_BOILERPLATE_PATTERNS = (
    "klik hier voor meer",
    "click here for more",
    "voor meer informatie",
    "for more information",
    "klik hier voor tickets",
    "buy tickets",
    "meer info & tickets",
)


def clean(text: str) -> str:
    return html.unescape(text).strip()


def _is_boilerplate(desc: str) -> bool:
    lower = desc.lower()
    return any(p in lower for p in _BOILERPLATE_PATTERNS) and len(desc) < 200


def summarise(show: Show) -> str | None:
    desc = clean(show.description)[:800] if show.description else None
    if desc and _is_boilerplate(desc):
        desc = None  # treat as no description

    if desc:
        prompt = PROMPT_TEMPLATE.format(
            title=clean(show.title),
            type=show.type or "performance",
            description=desc,
        )
    else:
        # No description — ask the model what it knows about the act from its training data
        prompt = PROMPT_TEMPLATE_NO_DESC.format(title=clean(show.title))

    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY not set")
    resp = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 60},
        timeout=20,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"].strip().strip('"').strip("'")
    if not text:
        return None
    # Discard unhelpful / hallucinated responses
    lower = text.lower()
    if any(p in lower for p in (
        "couldn't find", "i don't know", "no information", "not familiar", "i'm not sure",
        "unknown", "i cannot", "i can't", "i was unable", "i have no",
        "unique musical experience", "unique experience", "to the iconic venue",
        "bringing a unique", "a truly unique",
    )):
        return None
    # trim to first sentence if the model rambles
    for sep in [".", "!", "?"]:
        if sep in text:
            text = text.split(sep)[0] + sep
            break
    return text or None


def main():
    rerun_all = "--all" in sys.argv

    with Session(engine) as session:
        if rerun_all:
            shows = session.exec(select(Show)).all()
        else:
            shows = session.exec(
                select(Show).where(Show.summary == None)
            ).all()

    print(f"Shows to summarise: {len(shows)}")
    if not shows:
        print("Nothing to do.")
        return

    updated = 0
    errors = 0
    with Session(engine) as session:
        for show in shows:
            try:
                summary = summarise(show)
            except Exception as e:
                print(f"  skip {show.title[:40]}: {e}")
                errors += 1
                continue

            if summary:
                db_show = session.get(Show, show.id)
                if db_show:
                    db_show.summary = summary
                    session.add(db_show)
                    updated += 1

            if updated % BATCH_SIZE == 0 and updated > 0:
                session.commit()
                print(f"  {updated}/{len(shows)} summarised…")

        session.commit()

    print(f"Done. Summarised {updated} shows, {errors} errors.")


if __name__ == "__main__":
    main()
