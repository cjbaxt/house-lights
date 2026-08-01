"""Run a SQL migration file against Supabase using the direct DB connection.

Usage:
    SUPABASE_DB_URL="postgresql://postgres:<password>@<host>:5432/postgres" python run_migration.py migrate_001.sql
"""
import os
import sys
from pathlib import Path
import psycopg2

DIRECT_URI = os.environ.get("SUPABASE_DB_URL")
if not DIRECT_URI:
    print("Error: SUPABASE_DB_URL environment variable not set.", file=sys.stderr)
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <migration_file.sql>", file=sys.stderr)
        sys.exit(1)
    sql_path = Path(sys.argv[1]).resolve()
    if not sql_path.exists():
        print(f"Error: file not found: {sql_path}", file=sys.stderr)
        sys.exit(1)
    sql = sql_path.read_text()

    conn = psycopg2.connect(DIRECT_URI)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute(sql)
        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
