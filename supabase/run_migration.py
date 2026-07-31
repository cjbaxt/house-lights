"""Run a SQL migration file against Supabase using the direct DB connection."""
import sys
import psycopg2

DIRECT_URI = "postgresql://postgres:REDACTED@db.dbezgeiolffbvxefpuga.supabase.co:5432/postgres"

def main():
    sql_file = sys.argv[1] if len(sys.argv) > 1 else "migrate_001_city_preferences.sql"
    sql = open(sql_file).read()

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
