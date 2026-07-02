"""
Generates one-sentence AI summaries for shows using a local Ollama model.
Run: python enrich_summaries.py [--all]

Requires a generative model — pull one first:
  ollama pull llama3.2:3b
"""
import sys
import html
import ollama
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Show

BATCH_SIZE = 20
MODEL = "llama3.2:3b"

PROMPT_TEMPLATE = """Write a single sentence (max 20 words) describing this event for someone deciding whether to go.
Be specific and vivid. No filler phrases like "Don't miss" or "An unmissable". No trailing punctuation needed.

Title: {title}
Type: {type}
Description: {description}

One sentence:"""

PROMPT_TEMPLATE_NO_DESC = """Write a single sentence (max 20 words) about the artist or act "{title}" — what kind of music or performance they are known for.
Be specific. No filler phrases like "Don't miss" or "An unmissable". No trailing punctuation needed.
If you don't recognise the name, write nothing.

One sentence:"""


def clean(text: str) -> str:
    return html.unescape(text).strip()


def summarise(show: Show) -> str | None:
    if show.description:
        desc = clean(show.description)[:800]
        prompt = PROMPT_TEMPLATE.format(
            title=clean(show.title),
            type=show.type or "performance",
            description=desc,
        )
    else:
        # No description — ask the model what it knows about the act from its training data
        prompt = PROMPT_TEMPLATE_NO_DESC.format(title=clean(show.title))

    resp = ollama.generate(model=MODEL, prompt=prompt, options={"temperature": 0.3})
    text = resp["response"].strip().strip('"').strip("'")
    if not text:
        return None
    # Discard "I don't know" responses from the no-description path
    lower = text.lower()
    if any(p in lower for p in ("couldn't find", "i don't know", "no information", "not familiar", "i'm not sure")):
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
