# migrate_db.py
from pathlib import Path
import sqlite3

db_path = Path(__file__).resolve().parent / "app.db"  # matches app/database.py
print("Using DB:", db_path)

con = sqlite3.connect(str(db_path))
cur = con.cursor()

def ensure_col(table, name, ddl):
    cur.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cur.fetchall()]
    if name not in cols:
        print(f"Adding {table}.{name} ...")
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
        con.commit()
    else:
        print(f"{table}.{name} already exists.")

# Add missing columns safely
ensure_col("tasks", "tags", "TEXT NOT NULL DEFAULT '[]'")
ensure_col("events", "all_day", "BOOLEAN NOT NULL DEFAULT 0")

con.close()
print("Migration complete.")