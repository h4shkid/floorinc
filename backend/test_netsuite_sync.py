"""
Local diagnostic script for NetSuite sync.
Run: cd backend && python3 test_netsuite_sync.py

Logs every step so we can see exactly where things fail or get weird.
Does NOT write to the production database — read-only against NetSuite,
writes to a local test.db only.
"""

import os
import sys
import time
import sqlite3

# Set credentials (same as Render env vars)
os.environ["NETSUITE_ACCOUNT_ID"] = "4930797"
os.environ["NETSUITE_CONSUMER_KEY"] = "be992b103db9602b9bd4c83bf40cbc8e0282906b30c07707865fea0682727afa"
os.environ["NETSUITE_CONSUMER_SECRET"] = "3409c6ad4dd8cf74dcc3388bfed7204e1fce8f8614806b6e94cfc25a2a976bc1"
os.environ["NETSUITE_TOKEN_KEY"] = "5dbe40fb896dea018a89b98255c55212792a6067573ae08b1bd6e766ff37db7f"
os.environ["NETSUITE_TOKEN_SECRET"] = "f3c2d122b7c9403c4fd1ee78d20b73dcc07353a0ab0354c5ec43f99bed522506"

from services.netsuite_client import execute_suiteql, execute_suiteql_paginated, _get_session

CHANNEL_MAP = {
    "Magento2": "FI",
    "Amazon": "Amazon Seller Central",
    "AmazonVendorCentral-DirectFulfillment": "Amazon Vendor Central",
    "Walmart": "Walmart",
    "eBay": "eBay",
}

def map_channel(raw):
    if not raw:
        return "Other"
    for prefix, mapped in CHANNEL_MAP.items():
        if raw.startswith(prefix):
            return mapped
    return "Other"

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def test_inventory():
    log("=" * 60)
    log("PHASE 1: INVENTORY QUANTITIES")
    log("=" * 60)

    qty_query = """
        SELECT
            item.itemId AS sku,
            item.displayName AS display_name,
            SUM(loc.quantityAvailable) AS on_hand
        FROM inventoryItem item
        JOIN inventoryItemLocations loc ON loc.item = item.id
        WHERE item.isInactive = 'F'
        GROUP BY item.itemId, item.displayName
    """

    # First page only to check structure
    log("Fetching first page of inventory...")
    first_page = execute_suiteql(qty_query, limit=5, offset=0)
    log(f"  totalResults: {first_page.get('totalResults')}")
    log(f"  hasMore: {first_page.get('hasMore')}")
    log(f"  items count: {len(first_page.get('items', []))}")
    if first_page.get("items"):
        log(f"  sample row: {first_page['items'][0]}")

    # Full fetch
    log("Fetching ALL inventory quantities...")
    start = time.time()
    page_count = [0]

    def inv_progress(fetched, total):
        page_count[0] += 1
        if page_count[0] % 5 == 0 or fetched == total:
            log(f"  inventory qty: {fetched:,}/{total:,} rows")

    rows = execute_suiteql_paginated(qty_query, progress_callback=inv_progress)
    elapsed = time.time() - start
    log(f"  DONE: {len(rows):,} rows in {elapsed:.1f}s")

    # Build map
    inv_map = {}
    empty_sku = 0
    for r in rows:
        sku = r.get("sku", "")
        if not sku:
            empty_sku += 1
            continue
        inv_map[sku] = {
            "sku": sku,
            "display_name": r.get("display_name") or sku,
            "on_hand": int(float(r.get("on_hand") or 0)),
        }

    log(f"  Unique SKUs: {len(inv_map):,}")
    log(f"  Empty SKU rows skipped: {empty_sku}")

    # Check on_hand distribution
    positive = sum(1 for v in inv_map.values() if v["on_hand"] > 0)
    zero = sum(1 for v in inv_map.values() if v["on_hand"] == 0)
    negative = sum(1 for v in inv_map.values() if v["on_hand"] < 0)
    log(f"  on_hand > 0: {positive:,}")
    log(f"  on_hand = 0: {zero:,}")
    log(f"  on_hand < 0: {negative:,}")

    log("")
    log("=" * 60)
    log("PHASE 2: VENDOR/MANUFACTURER")
    log("=" * 60)

    vendor_query = """
        SELECT
            item.itemId AS sku,
            vendor.companyName AS manufacturer
        FROM inventoryItem item
        LEFT JOIN vendor ON vendor.id = item.vendor
        WHERE item.isInactive = 'F'
    """

    log("Fetching ALL vendor info...")
    start = time.time()
    vendor_rows = execute_suiteql_paginated(vendor_query)
    elapsed = time.time() - start
    log(f"  DONE: {len(vendor_rows):,} rows in {elapsed:.1f}s")

    matched = 0
    for r in vendor_rows:
        sku = r.get("sku", "")
        if sku in inv_map:
            inv_map[sku]["manufacturer"] = r.get("manufacturer") or ""
            matched += 1

    log(f"  Matched to inventory: {matched:,}")

    # Flag samples
    samples = 0
    records = []
    for item in inv_map.values():
        sku = item["sku"]
        display_name = item["display_name"]
        is_sample = 1 if (sku.startswith("S-") or "sample" in display_name.lower()) else 0
        if is_sample:
            samples += 1
        records.append({
            "sku": sku,
            "display_name": display_name,
            "on_hand": item["on_hand"],
            "is_sample": is_sample,
            "manufacturer": item.get("manufacturer", ""),
        })

    log(f"  Total inventory records: {len(records):,}")
    log(f"  Samples flagged: {samples:,}")
    log(f"  Non-sample SKUs: {len(records) - samples:,}")

    return records


def test_sales():
    log("")
    log("=" * 60)
    log("PHASE 3: SALES DATA")
    log("=" * 60)

    # First, check what the query returns
    sales_query = """
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
          AND t.tranDate >= ADD_MONTHS(SYSDATE, -18)
          AND tl.quantity < 0
    """

    # Use monthly chunking like the real sync does
    from datetime import date, timedelta
    from services.netsuite_sync import _build_monthly_chunks, _fetch_sales_chunk

    today = date.today()
    start_date = today - timedelta(days=18 * 30)
    chunks = _build_monthly_chunks(start_date, today)

    log(f"  Fetching sales in {len(chunks)} monthly chunks...")
    log(f"  Date range: {start_date} to {today}")

    start = time.time()
    rows = []
    for i, (chunk_start, chunk_end) in enumerate(chunks):
        chunk_start_time = time.time()
        chunk_rows = _fetch_sales_chunk(chunk_start, chunk_end)
        chunk_elapsed = time.time() - chunk_start_time
        rows.extend(chunk_rows)
        log(f"  Month {i+1}/{len(chunks)}: {chunk_start} to {chunk_end} → {len(chunk_rows):,} rows ({chunk_elapsed:.1f}s) [total: {len(rows):,}]")
    elapsed = time.time() - start
    log(f"  DONE: {len(rows):,} rows in {elapsed:.1f}s")

    # Process records
    records = []
    empty_sku = 0
    unique_skus = set()
    channels = {}

    for r in rows:
        sku = r.get("sku", "")
        if not sku:
            empty_sku += 1
            continue
        unique_skus.add(sku)
        ch = map_channel(r.get("channel"))
        channels[ch] = channels.get(ch, 0) + 1
        records.append({
            "order_date": r.get("order_date", ""),
            "sku": sku,
            "quantity": int(float(r.get("quantity") or 0)),
            "channel": ch,
            "item_revenue": float(r.get("item_revenue") or 0),
            "product_name": r.get("product_name") or "",
        })

    log(f"  Total sales records: {len(records):,}")
    log(f"  Empty SKU rows skipped: {empty_sku}")
    log(f"  Unique SKUs in sales: {len(unique_skus):,}")
    log(f"  Channel breakdown:")
    for ch, count in sorted(channels.items(), key=lambda x: -x[1]):
        log(f"    {ch}: {count:,}")

    # Date range
    dates = [r["order_date"] for r in records if r["order_date"]]
    if dates:
        log(f"  Date range: {min(dates)} to {max(dates)}")

    return records


def test_dashboard_simulation(inv_records, sales_records):
    """Simulate what the dashboard would show after inserting this data."""
    log("")
    log("=" * 60)
    log("PHASE 4: DASHBOARD SIMULATION")
    log("=" * 60)

    db_path = "/tmp/test_netsuite_sync.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute("""CREATE TABLE inventory (
        sku TEXT PRIMARY KEY, display_name TEXT, on_hand INTEGER, is_sample INTEGER, manufacturer TEXT
    )""")
    conn.execute("""CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_date TEXT, sku TEXT, quantity INTEGER,
        channel TEXT, product_category TEXT, item_revenue REAL, product_cost REAL, product_name TEXT
    )""")

    conn.executemany(
        "INSERT INTO inventory VALUES (:sku, :display_name, :on_hand, :is_sample, :manufacturer)",
        inv_records,
    )

    conn.executemany(
        "INSERT INTO sales (order_date, sku, quantity, channel, product_category, item_revenue, product_cost, product_name) VALUES (:order_date, :sku, :quantity, :channel, NULL, :item_revenue, 0.0, :product_name)",
        sales_records,
    )
    conn.commit()

    # Check what the dashboard query would return
    total_inv = conn.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
    total_sales = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
    non_sample = conn.execute("SELECT COUNT(*) FROM inventory WHERE is_sample = 0").fetchone()[0]
    with_stock = conn.execute("SELECT COUNT(*) FROM inventory WHERE is_sample = 0 AND on_hand > 0").fetchone()[0]

    log(f"  Total inventory rows: {total_inv:,}")
    log(f"  Total sales rows: {total_sales:,}")
    log(f"  Non-sample SKUs: {non_sample:,}")
    log(f"  Non-sample with stock > 0: {with_stock:,}")

    # Simulate active_only filter (what the dashboard uses by default)
    # active_only means: has sales in last 90 days OR on_hand > 0
    active_query = """
        SELECT COUNT(DISTINCT i.sku)
        FROM inventory i
        WHERE i.is_sample = 0
        AND (
            i.on_hand > 0
            OR EXISTS (
                SELECT 1 FROM sales s
                WHERE s.sku = i.sku
                AND s.order_date >= date('now', '-90 days')
            )
        )
    """
    active_count = conn.execute(active_query).fetchone()[0]
    log(f"  Active SKUs (stock>0 OR sales in 90d): {active_count:,}")

    # SKUs that have sales but NOT in inventory
    sales_only = conn.execute("""
        SELECT COUNT(DISTINCT s.sku)
        FROM sales s
        WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.sku = s.sku)
    """).fetchone()[0]
    log(f"  SKUs in sales but NOT in inventory: {sales_only:,}")

    # SKUs in inventory with sales
    inv_with_sales = conn.execute("""
        SELECT COUNT(DISTINCT i.sku)
        FROM inventory i
        WHERE EXISTS (SELECT 1 FROM sales s WHERE s.sku = i.sku)
    """).fetchone()[0]
    log(f"  Inventory SKUs with sales data: {inv_with_sales:,}")

    # Sample some SKUs that show on dashboard
    log("  Sample active SKUs:")
    sample = conn.execute("""
        SELECT i.sku, i.on_hand, i.is_sample,
               (SELECT COUNT(*) FROM sales s WHERE s.sku = i.sku) as sale_count
        FROM inventory i
        WHERE i.is_sample = 0 AND i.on_hand > 0
        ORDER BY i.on_hand DESC
        LIMIT 5
    """).fetchall()
    for row in sample:
        log(f"    {row[0]}: on_hand={row[1]}, is_sample={row[2]}, sales={row[3]}")

    conn.close()
    os.remove(db_path)


if __name__ == "__main__":
    log("Starting NetSuite sync diagnostic...")
    log(f"Python: {sys.version}")
    log("")

    try:
        inv = test_inventory()
        sales = test_sales()
        test_dashboard_simulation(inv, sales)
    except Exception as e:
        log(f"FATAL ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    log("")
    log("DONE")
