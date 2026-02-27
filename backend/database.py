import os
import sqlite3
from config import DB_PATH

TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")
_LOCAL_REPLICA = "/tmp/forecast.db"


def sync_from_turso():
    """Pull latest data from Turso into a local SQLite replica."""
    if not TURSO_URL:
        return
    import libsql_experimental as libsql

    conn = libsql.connect(_LOCAL_REPLICA, sync_url=TURSO_URL, auth_token=TURSO_TOKEN)
    conn.sync()
    conn.close()
    print(f"Synced Turso → {_LOCAL_REPLICA}")


def sync_to_turso():
    """Push local changes back to Turso."""
    if not TURSO_URL:
        return
    import libsql_experimental as libsql

    conn = libsql.connect(_LOCAL_REPLICA, sync_url=TURSO_URL, auth_token=TURSO_TOKEN)
    conn.sync()
    conn.close()


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
    conn.close()
