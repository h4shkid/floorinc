import os
import sqlite3
from config import DB_PATH

_LOCAL_REPLICA = "/tmp/forecast.db"


def _cloud_configured() -> bool:
    from r2_sync import is_configured
    return is_configured()


def sync_from_cloud():
    """Download database from Cloudflare R2 on startup."""
    from r2_sync import download_db, is_configured
    if not is_configured():
        return

    # Clean up corrupted replica
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

    download_db(_LOCAL_REPLICA)


def sync_to_cloud():
    """Upload database to Cloudflare R2 after data changes."""
    from r2_sync import upload_db, is_configured
    if not is_configured():
        return
    upload_db(_LOCAL_REPLICA)


def get_connection() -> sqlite3.Connection:
    db_path = _LOCAL_REPLICA if _cloud_configured() else str(DB_PATH)
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
            product_name TEXT,
            raw_channel TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sales_sku ON sales(sku);
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(order_date);
        CREATE INDEX IF NOT EXISTS idx_sales_sku_date ON sales(sku, order_date);
        CREATE INDEX IF NOT EXISTS idx_sales_revenue ON sales(order_date, item_revenue);

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

        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number TEXT NOT NULL,
            po_date TEXT,
            status TEXT,
            vendor TEXT,
            sku TEXT NOT NULL,
            ordered_qty INTEGER NOT NULL DEFAULT 0,
            received_qty INTEGER NOT NULL DEFAULT 0,
            remaining_qty INTEGER NOT NULL DEFAULT 0,
            expected_date TEXT,
            rate REAL DEFAULT 0,
            amount REAL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_po_sku ON purchase_orders(sku);
        CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor);

        CREATE TABLE IF NOT EXISTS chat_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            expires_at TEXT
        );
    """)
    conn.commit()

    # Migrations — add columns to existing tables
    migrations = [
        "ALTER TABLE inventory ADD COLUMN manufacturer TEXT DEFAULT ''",
        "ALTER TABLE inventory ADD COLUMN item_cost REAL DEFAULT 0",
        "ALTER TABLE inventory ADD COLUMN qty_on_order INTEGER DEFAULT 0",
        "ALTER TABLE inventory ADD COLUMN qty_committed INTEGER DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN raw_channel TEXT",
        "ALTER TABLE inventory ADD COLUMN is_drop_ship INTEGER DEFAULT 0",
        "ALTER TABLE inventory ADD COLUMN is_warehoused INTEGER DEFAULT 0",
        "ALTER TABLE inventory ADD COLUMN source_type TEXT DEFAULT ''",
    ]
    for sql in migrations:
        try:
            conn.execute(sql)
            conn.commit()
        except Exception:
            pass  # Column already exists

    # Migrate channel values to match updated CHANNEL_MAP
    conn.executescript("""
        UPDATE sales SET channel = 'Home Depot' WHERE channel = 'HomeDepot';
        UPDATE sales SET channel = 'eBay' WHERE channel = 'Ebay';
        UPDATE sales SET channel = 'Walmart' WHERE channel = 'Walmart - Seller Fulfilled';
        UPDATE sales SET channel = 'Walmart' WHERE channel = 'Walmart  - WFS';
        UPDATE sales SET channel = 'Other' WHERE channel = 'FBA';
        UPDATE sales SET channel = 'Other' WHERE channel = '- None -';
    """)
    conn.commit()

    conn.close()
