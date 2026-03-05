"""
Fast NetSuite -> Local SQLite -> Turso sync.

Phase 1: Fetch from NetSuite -> write to local SQLite (fast local disk I/O)
Phase 2: Push local SQLite -> Turso via HTTP Pipeline batch API (concurrent)

Performance:
  - NetSuite fetch: ~2-4 min (API-bound, can't speed up further)
  - Local SQLite writes: <1 sec (21K inv + 410K sales)
  - Turso push: ~20-40 sec (vs 15+ min with old row-by-row approach)

Run: cd backend && python3 push_to_turso.py
"""

import os
import sqlite3
import time
from datetime import date, timedelta

os.environ["NETSUITE_ACCOUNT_ID"] = "4930797"
os.environ["NETSUITE_CONSUMER_KEY"] = "be992b103db9602b9bd4c83bf40cbc8e0282906b30c07707865fea0682727afa"
os.environ["NETSUITE_CONSUMER_SECRET"] = "3409c6ad4dd8cf74dcc3388bfed7204e1fce8f8614806b6e94cfc25a2a976bc1"
os.environ["NETSUITE_TOKEN_KEY"] = "5dbe40fb896dea018a89b98255c55212792a6067573ae08b1bd6e766ff37db7f"
os.environ["NETSUITE_TOKEN_SECRET"] = "f3c2d122b7c9403c4fd1ee78d20b73dcc07353a0ab0354c5ec43f99bed522506"

TURSO_URL = "libsql://flooringinc-mertmodoglu.aws-us-east-1.turso.io"
TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzIxOTE0NDQsImlkIjoiMDE5YzllYzgtMjkwMS03ZWVjLTgwZGEtYzM3ZTIwYjJkY2E2IiwicmlkIjoiMGNiM2FmMjItY2Y3My00NzIxLWJjNDAtZjFlNDY1MWZlYmI2In0.1w0GvOgBZBBZlcd4JkHppOqUBx6smE7En_JaZN87UAhlr-Nfcw73qbT6_AVOK_QMNYRE8nVxAXWQ4rhDpkv4Cw"

LOCAL_DB = "/tmp/forecast.db"

from services.netsuite_client import execute_suiteql_paginated
from services.netsuite_sync import _build_monthly_chunks, _map_channel
from turso_fast import sync_all_tables


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def init_local_db(db_path):
    """Create/open local SQLite with schema."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS inventory (
            sku TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            on_hand INTEGER NOT NULL DEFAULT 0,
            is_sample INTEGER NOT NULL DEFAULT 0,
            manufacturer TEXT DEFAULT ''
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
    return conn


def main():
    t_total = time.time()

    # ==========================================
    # PHASE 1: NetSuite -> Local SQLite
    # ==========================================
    log("Opening local SQLite...")
    local = init_local_db(LOCAL_DB)

    # --- INVENTORY ---
    log("")
    log("=== PHASE 1: INVENTORY (NetSuite -> Local SQLite) ===")

    log("Fetching inventory quantities from NetSuite...")
    qty_rows = execute_suiteql_paginated("""
        SELECT item.itemId AS sku, item.displayName AS display_name,
               SUM(loc.quantityAvailable) AS on_hand
        FROM inventoryItem item
        JOIN inventoryItemLocations loc ON loc.item = item.id
        WHERE item.isInactive = 'F'
        GROUP BY item.itemId, item.displayName
    """)
    log(f"  Got {len(qty_rows):,} inventory items")

    inv_map = {}
    for r in qty_rows:
        sku = r.get("sku", "")
        if sku:
            inv_map[sku] = {
                "sku": sku,
                "display_name": r.get("display_name") or sku,
                "on_hand": int(float(r.get("on_hand") or 0)),
            }

    log("Fetching vendor info from NetSuite...")
    vendor_rows = execute_suiteql_paginated("""
        SELECT item.itemId AS sku, vendor.companyName AS manufacturer
        FROM inventoryItem item
        LEFT JOIN vendor ON vendor.id = item.vendor
        WHERE item.isInactive = 'F'
    """)
    log(f"  Got {len(vendor_rows):,} vendor rows")

    for r in vendor_rows:
        sku = r.get("sku", "")
        if sku in inv_map:
            inv_map[sku]["manufacturer"] = r.get("manufacturer") or ""

    # Build and write inventory to LOCAL SQLite
    inv_records = []
    for item in inv_map.values():
        sku = item["sku"]
        dn = item["display_name"]
        is_sample = 1 if (sku.startswith("S-") or "sample" in dn.lower()) else 0
        inv_records.append((sku, dn, item["on_hand"], is_sample, item.get("manufacturer", "")))

    t0 = time.time()
    local.execute("DELETE FROM inventory")
    local.executemany(
        "INSERT INTO inventory (sku, display_name, on_hand, is_sample, manufacturer) VALUES (?,?,?,?,?)",
        inv_records,
    )
    local.commit()
    log(f"  Wrote {len(inv_records):,} inventory rows to local SQLite ({time.time()-t0:.2f}s)")

    # --- SALES ---
    log("")
    log("=== PHASE 2: SALES (NetSuite -> Local SQLite) ===")

    today = date.today()
    start_date = today - timedelta(days=18 * 30)
    chunks = _build_monthly_chunks(start_date, today)
    log(f"  {len(chunks)} months to fetch: {start_date} to {today}")

    local.execute("DELETE FROM sales")
    local.commit()

    total_sales = 0
    for i, (chunk_start, chunk_end) in enumerate(chunks):
        log(f"  Month {i+1}/{len(chunks)}: {chunk_start} to {chunk_end}")

        log(f"    Fetching from NetSuite...")
        t0 = time.time()
        query = f"""
            SELECT
                TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS order_date,
                item.itemId AS sku,
                ABS(tl.quantity) AS quantity,
                t.custbody_fa_channel AS channel,
                item.displayName AS product_name,
                ABS(tl.netAmount) AS item_revenue
            FROM transactionLine tl
            JOIN transaction t ON t.id = tl.transaction
            JOIN item ON item.id = tl.item
            WHERE tl.mainLine = 'F'
              AND tl.itemType = 'InvtPart'
              AND t.tranDate >= TO_DATE('{chunk_start}', 'YYYY-MM-DD')
              AND t.tranDate <= TO_DATE('{chunk_end}', 'YYYY-MM-DD')
              AND tl.quantity < 0
        """
        rows = execute_suiteql_paginated(query)
        fetch_time = time.time() - t0
        log(f"    Fetched {len(rows):,} rows ({fetch_time:.1f}s)")

        if not rows:
            continue

        # Convert to tuples
        records = []
        for r in rows:
            sku = r.get("sku", "")
            if not sku:
                continue
            records.append((
                r.get("order_date", ""),
                sku,
                int(float(r.get("quantity") or 0)),
                _map_channel(r.get("channel")),
                None,  # product_category
                float(r.get("item_revenue") or 0),
                0.0,   # product_cost
                r.get("product_name") or "",
            ))

        # Write to LOCAL SQLite (instant)
        t0 = time.time()
        local.executemany(
            "INSERT INTO sales (order_date, sku, quantity, channel, product_category, item_revenue, product_cost, product_name) VALUES (?,?,?,?,?,?,?,?)",
            records,
        )
        local.commit()
        total_sales += len(records)
        log(f"    Wrote to local SQLite ({time.time()-t0:.2f}s) — Total: {total_sales:,}")

    log(f"  All sales in local SQLite: {total_sales:,} rows")
    local.close()

    # ==========================================
    # PHASE 3: Local SQLite -> Turso (FAST)
    # ==========================================
    log("")
    log("=== PHASE 3: PUSH TO TURSO (HTTP Pipeline — concurrent batches) ===")
    sync_all_tables(LOCAL_DB, TURSO_URL, TURSO_TOKEN, log_fn=log)

    # ==========================================
    # DONE
    # ==========================================
    elapsed = time.time() - t_total
    log("")
    log(f"DONE in {elapsed:.0f}s! Site should show data now.")


if __name__ == "__main__":
    main()
