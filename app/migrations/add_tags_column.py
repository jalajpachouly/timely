# app/migrations/add_tags_column.py
from sqlalchemy import text
from ..db import engine  # uses the same DB your app is configured to use

def column_exists(table: str, column: str) -> bool:
    # PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
        return any(row[1] == column for row in rows)

def migrate_add_tags():
    with engine.begin() as conn:  # transactional
        if column_exists("tasks", "tags"):
            print("[migrate] 'tags' column already exists on tasks. Nothing to do.")
            return

        print("[migrate] Adding 'tags' column to tasks...")
        # TEXT column that stores JSON-encoded list; default '[]'
        conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]';")

        # Backfill existing rows (NULL/empty -> '[]')
        conn.exec_driver_sql(
            "UPDATE tasks SET tags='[]' WHERE tags IS NULL OR TRIM(tags) = '';"
        )

        print("[migrate] Done. 'tags' added and backfilled.")

if __name__ == "__main__":
    migrate_add_tags()
