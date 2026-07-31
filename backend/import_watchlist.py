"""Import watchlist.json into Supabase for a given user, looked up by email."""
import json
import os
import sys
from pathlib import Path
import httpx
from sqlmodel import Session, text
from app.db import engine

WATCHLIST_JSON = Path(__file__).parent.parent / "frontend/public/data/watchlist.json"

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
USER_EMAIL = os.environ.get("USER_EMAIL", "clairejb93@gmail.com")


def get_user_id(email: str) -> str:
    resp = httpx.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}", "apikey": SUPABASE_SERVICE_ROLE_KEY},
        params={"page": 1, "per_page": 50},
    )
    resp.raise_for_status()
    users = resp.json().get("users", [])
    for u in users:
        if u["email"] == email:
            return u["id"]
    raise ValueError(f"User {email} not found in Supabase auth")


def main():
    print(f"Looking up user ID for {USER_EMAIL}...")
    user_id = get_user_id(USER_EMAIL)
    print(f"Found user: {user_id}")

    entries = json.loads(WATCHLIST_JSON.read_text())
    print(f"Found {len(entries)} entries in watchlist.json\n")

    session = Session(engine)
    inserted = 0
    skipped = 0

    for entry in entries:
        show_id = entry["watchlist"]["show_id"]
        status = entry["watchlist"]["status"]
        added_at = entry["watchlist"]["added_at"]

        result = session.execute(text("SELECT id FROM show WHERE id = :id"), {"id": show_id}).fetchone()
        if not result:
            print(f"  SKIP (show not in DB): {entry['show']['title']}")
            skipped += 1
            continue

        session.execute(text("""
            INSERT INTO watchlist (user_id, show_id, status, added_at, updated_at)
            VALUES (:user_id, :show_id, :status, :added_at, now())
            ON CONFLICT (user_id, show_id) DO UPDATE SET status = EXCLUDED.status
        """), {"user_id": user_id, "show_id": show_id, "status": status, "added_at": added_at})
        print(f"  OK [{status}]: {entry['show']['title']} ({entry['show']['date']})")
        inserted += 1

    session.commit()
    session.close()
    print(f"\nDone: {inserted} inserted/updated, {skipped} skipped")


if __name__ == "__main__":
    main()
