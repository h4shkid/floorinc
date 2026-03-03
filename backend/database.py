import os
import sqlite3
from config import DB_PATH

TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")
_LOCAL_REPLICA = "/tmp/forecast.db"

SYNC_TABLES = ["inventory", "sales", "lead_times", "sku_insights"]


def sync_from_turso():
    """Pull latest data from Turso into a local SQLite replica."""
    if not TURSO_URL:
        return
    import libsql_experimental as libsql

    # Delete corrupted replica if it exists
    for suffix in ("", "-wal", "-shm"):
        path = _LOCAL_REPLICA + suffix
        if os.path.exists(path):
            try:
                if suffix == "":
                    c = sqlite3.connect(path)
                    c.execute("PRAGMA integrity_check")
                    c.close()
            except Exception:
                print(f"Corrupted replica detected, removing {path}")
                os.remove(path)

    conn = libsql.connect(_LOCAL_REPLICA, sync_url=TURSO_URL, auth_token=TURSO_TOKEN)
    conn.sync()
    conn.close()
    print(f"Synced Turso → {_LOCAL_REPLICA}")


def sync_to_turso():
    """Push local SQLite data to Turso by reading local and writing to remote."""
    if not TURSO_URL:
        return
    import libsql_experimental as libsql

    local = sqlite3.connect(_LOCAL_REPLICA)
    local.row_factory = sqlite3.Row
    remote = libsql.connect(TURSO_URL, auth_token=TURSO_TOKEN)

    for table in SYNC_TABLES:
        # Get column names
        cols_info = local.execute(f"PRAGMA table_info({table})").fetchall()
        if not cols_info:
            continue
        col_names = [c["name"] for c in cols_info]
        placeholders = ", ".join(["?" for _ in col_names])
        col_list = ", ".join(col_names)

        # Clear remote table
        remote.execute(f"DELETE FROM {table}")
        remote.commit()

        # Read local and write to remote in small batches, commit each
        cursor = local.execute(f"SELECT {col_list} FROM {table}")
        batch_size = 500
        total = 0
        while True:
            rows = cursor.fetchmany(batch_size)
            if not rows:
                break
            values = [tuple(row) for row in rows]
            remote.executemany(
                f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})",
                values,
            )
            remote.commit()
            total += len(rows)
        print(f"  Turso: pushed {total:,} rows to {table}")

    local.close()
    remote.close()
    print("Pushed local data → Turso")


def get_connection() -> sqlite3.Connection:
    db_path = _LOCAL_REPLICA if TURSO_URL else str(DB_PATH)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS inventory (
            sku TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            on_hand INTEGER NOT NULL DEFAULT 0,
            is_sample INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_date TEXT NOT NULL,
            sku TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            channel TEXT,
            product_category TEXT,
            item_revenue REAL,
            product_cost REAL,
            product_name TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sales_sku ON sales(sku);
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(order_date);
        CREATE INDEX IF NOT EXISTS idx_sales_sku_date ON sales(sku, order_date);

        CREATE TABLE IF NOT EXISTS lead_times (
            sku TEXT PRIMARY KEY,
            product_category TEXT,
            lead_time_days INTEGER NOT NULL DEFAULT 45,
            source TEXT DEFAULT 'domestic',
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sku_insights (
            sku TEXT PRIMARY KEY,
            insight TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'qwen2.5:7b',
            generated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()

    # Migrations — add columns to existing tables
    try:
        conn.execute("ALTER TABLE inventory ADD COLUMN manufacturer TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass  # Column already exists

    conn.close()
