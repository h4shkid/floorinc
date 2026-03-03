from datetime import date, timedelta

from database import get_connection, sync_to_cloud
from services.netsuite_client import execute_suiteql_paginated
from services.sync_status import sync_status


CHANNEL_MAP = {
    # More specific prefixes MUST come before shorter ones (startswith matching)
    "AmazonVendorCentral": "Amazon Vendor Central",
    "Amazon": "Amazon Seller Central",
    "Magento2TEST": "Other",
    "Magento2": "FI",
    "HomeDepot": "Home Depot",
    "Wayfair": "Wayfair",
    "Walmart": "Walmart",
    "Ebay": "eBay",
    "eBay": "eBay",
    "FBA": "FBA",
    "- None -": "Other",
}


def _map_channel(raw: str | None) -> str:
    if not raw:
        return "Other"
    for prefix, mapped in CHANNEL_MAP.items():
        if raw.startswith(prefix):
            return mapped
    return "Other"


def sync_inventory(progress_callback=None):
    """Pull inventory from NetSuite: stock quantities + vendor names."""

    # Query 1: stock quantities + order data from TN DC warehouse (location ID 3)
    qty_query = """
        SELECT
            item.itemId AS sku,
            item.displayName AS display_name,
            SUM(loc.quantityAvailable) AS on_hand,
            SUM(loc.quantityOnOrder) AS qty_on_order,
            SUM(loc.quantityCommitted) AS qty_committed
        FROM inventoryItem item
        JOIN inventoryItemLocations loc ON loc.item = item.id
        WHERE item.isInactive = 'F'
          AND loc.location = 3
        GROUP BY item.itemId, item.displayName
    """

    def qty_progress(fetched, total):
        pct = int((fetched / total) * 25)
        if progress_callback:
            progress_callback("inventory_qty", pct, f"Fetching inventory quantities... {fetched:,}/{total:,}")

    rows = execute_suiteql_paginated(qty_query, progress_callback=qty_progress)

    # Build lookup: sku -> {display_name, on_hand}
    inv_map = {}
    for r in rows:
        sku = r.get("sku", "")
        if not sku:
            continue
        inv_map[sku] = {
            "sku": sku,
            "display_name": r.get("display_name") or sku,
            "on_hand": int(float(r.get("on_hand") or 0)),
            "qty_on_order": int(float(r.get("qty_on_order") or 0)),
            "qty_committed": int(float(r.get("qty_committed") or 0)),
        }

    # Query 2: vendor/manufacturer names + item cost
    vendor_query = """
        SELECT
            item.itemId AS sku,
            vendor.companyName AS manufacturer,
            item.cost AS item_cost
        FROM inventoryItem item
        LEFT JOIN vendor ON vendor.id = item.vendor
        WHERE item.isInactive = 'F'
    """

    def vendor_progress(fetched, total):
        pct = 25 + int((fetched / total) * 25)
        if progress_callback:
            progress_callback("inventory_vendor", pct, f"Fetching vendor info... {fetched:,}/{total:,}")

    vendor_rows = execute_suiteql_paginated(vendor_query, progress_callback=vendor_progress)

    for r in vendor_rows:
        sku = r.get("sku", "")
        if sku in inv_map:
            inv_map[sku]["manufacturer"] = r.get("manufacturer") or ""
            inv_map[sku]["item_cost"] = float(r.get("item_cost") or 0)

    # Flag samples and insert
    records = []
    for item in inv_map.values():
        sku = item["sku"]
        display_name = item["display_name"]
        is_sample = 1 if (
            sku.startswith("S-")
            or "sample" in display_name.lower()
        ) else 0
        records.append({
            "sku": sku,
            "display_name": display_name,
            "on_hand": item["on_hand"],
            "is_sample": is_sample,
            "manufacturer": item.get("manufacturer", ""),
            "item_cost": item.get("item_cost", 0),
            "qty_on_order": item.get("qty_on_order", 0),
            "qty_committed": item.get("qty_committed", 0),
        })

    conn = get_connection()

    # Preserve drop ship / warehoused / source_type flags before wiping
    saved_flags = {}
    for row in conn.execute(
        "SELECT sku, is_drop_ship, is_warehoused, source_type FROM inventory WHERE is_drop_ship = 1 OR is_warehoused = 1 OR source_type != ''"
    ).fetchall():
        saved_flags[row["sku"]] = (row["is_drop_ship"], row["is_warehoused"], row["source_type"] or "")

    conn.execute("DELETE FROM inventory")
    conn.executemany(
        """INSERT INTO inventory (sku, display_name, on_hand, is_sample, manufacturer, item_cost, qty_on_order, qty_committed, is_drop_ship, is_warehoused)
           VALUES (:sku, :display_name, :on_hand, :is_sample, :manufacturer, :item_cost, :qty_on_order, :qty_committed, 0, 0)""",
        records,
    )

    # Restore saved flags
    if saved_flags:
        conn.executemany(
            "UPDATE inventory SET is_drop_ship = ?, is_warehoused = ?, source_type = ? WHERE sku = ?",
            [(ds, wh, st, sku) for sku, (ds, wh, st) in saved_flags.items()],
        )

    conn.commit()
    conn.close()

    return len(records)


def _build_monthly_chunks(start_date: date, end_date: date) -> list[tuple[str, str]]:
    """Build monthly date ranges for chunked queries."""
    chunks = []
    current = start_date
    while current <= end_date:
        chunk_end = (current.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        if chunk_end > end_date:
            chunk_end = end_date
        chunks.append((current.strftime("%Y-%m-%d"), chunk_end.strftime("%Y-%m-%d")))
        current = chunk_end + timedelta(days=1)
    return chunks


def _fetch_sales_chunk(chunk_start: str, chunk_end: str) -> list[dict]:
    """Fetch one month of sales from NetSuite (sales orders only)."""
    query = f"""
        SELECT
            TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS order_date,
            item.itemId AS sku,
            tl.quantity AS quantity,
            t.custbody_fa_channel AS channel,
            item.displayName AS product_name,
            tl.netAmount AS item_revenue
        FROM transactionLine tl
        JOIN transaction t ON t.id = tl.transaction
        JOIN item ON item.id = tl.item
        WHERE tl.mainLine = 'F'
          AND t.type = 'SalesOrd'
          AND t.status != 'C'
          AND tl.itemType IN ('InvtPart', 'Kit')
          AND t.tranDate >= TO_DATE('{chunk_start}', 'YYYY-MM-DD')
          AND t.tranDate <= TO_DATE('{chunk_end}', 'YYYY-MM-DD')
          AND tl.quantity > 0
    """
    return execute_suiteql_paginated(query)


def sync_sales(progress_callback=None):
    """Pull sales from NetSuite in monthly chunks to stay within 100K offset limit.
    Incremental: only fetches months newer than what's already in DB."""

    # Check the latest order_date we already have
    conn = get_connection()
    row = conn.execute("SELECT MAX(order_date) FROM sales").fetchone()
    last_date = row[0] if row and row[0] else None
    conn.close()

    today = date.today()

    if last_date:
        start = date.fromisoformat(last_date)
    else:
        start = today - timedelta(days=18 * 30)

    chunks = _build_monthly_chunks(start, today)
    total_chunks = len(chunks)
    all_records = []

    for i, (chunk_start, chunk_end) in enumerate(chunks):
        pct = 50 + int((i / total_chunks) * 48)
        if progress_callback:
            progress_callback("sales", pct, f"Fetching sales {chunk_start} to {chunk_end}... ({i+1}/{total_chunks} months)")

        rows = _fetch_sales_chunk(chunk_start, chunk_end)

        for r in rows:
            sku = r.get("sku", "")
            if not sku:
                continue
            # Skip deprecated/retired SKUs
            if (
                sku.endswith("OLD")
                or "_old" in sku
                or "_delete" in sku.lower()
                or "Delete" in (r.get("product_name") or "")
            ):
                continue
            raw_ch = r.get("channel") or ""
            all_records.append({
                "order_date": r.get("order_date", ""),
                "sku": sku,
                "quantity": int(float(r.get("quantity") or 0)),
                "channel": _map_channel(r.get("channel")),
                "product_category": None,
                "item_revenue": float(r.get("item_revenue") or 0),
                "product_cost": 0.0,
                "product_name": r.get("product_name") or "",
                "raw_channel": raw_ch,
            })

    conn = get_connection()
    if last_date:
        conn.execute("DELETE FROM sales WHERE order_date >= ?", (last_date,))
    else:
        conn.execute("DELETE FROM sales")
    conn.executemany(
        """INSERT INTO sales (order_date, sku, quantity, channel, product_category, item_revenue, product_cost, product_name, raw_channel)
           VALUES (:order_date, :sku, :quantity, :channel, :product_category, :item_revenue, :product_cost, :product_name, :raw_channel)""",
        all_records,
    )
    conn.commit()
    conn.close()

    return len(all_records)


def sync_purchase_orders(progress_callback=None):
    """Pull open purchase order lines from NetSuite with remaining qty > 0."""
    query = """
        SELECT t.tranId AS po_number, TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS po_date,
               t.status, v.companyName AS vendor, item.itemId AS sku,
               tl.quantity AS ordered_qty,
               COALESCE(tl.quantityShipRecv, 0) AS received_qty,
               (tl.quantity - COALESCE(tl.quantityShipRecv, 0)) AS remaining_qty,
               TO_CHAR(tl.expectedReceiptDate, 'YYYY-MM-DD') AS expected_date,
               tl.rate, tl.amount
        FROM transactionLine tl
        JOIN transaction t ON t.id = tl.transaction
        JOIN item ON item.id = tl.item
        LEFT JOIN vendor v ON v.id = t.entity
        WHERE t.type = 'PurchOrd'
          AND t.status IN ('B', 'D', 'E')
          AND tl.mainLine = 'F'
          AND tl.quantity > 0
          AND (tl.quantity - COALESCE(tl.quantityShipRecv, 0)) > 0
    """

    def po_progress(fetched, total):
        pct = int((fetched / total) * 100)
        if progress_callback:
            progress_callback("purchase_orders", pct, f"Fetching purchase orders... {fetched:,}/{total:,}")

    rows = execute_suiteql_paginated(query, progress_callback=po_progress)

    records = []
    for r in rows:
        sku = r.get("sku", "")
        if not sku:
            continue
        records.append({
            "po_number": r.get("po_number") or "",
            "po_date": r.get("po_date"),
            "status": r.get("status") or "",
            "vendor": r.get("vendor"),
            "sku": sku,
            "ordered_qty": int(float(r.get("ordered_qty") or 0)),
            "received_qty": int(float(r.get("received_qty") or 0)),
            "remaining_qty": int(float(r.get("remaining_qty") or 0)),
            "expected_date": r.get("expected_date"),
            "rate": float(r.get("rate") or 0),
            "amount": float(r.get("amount") or 0),
        })

    conn = get_connection()
    conn.execute("DELETE FROM purchase_orders")
    conn.executemany(
        """INSERT INTO purchase_orders (po_number, po_date, status, vendor, sku, ordered_qty, received_qty, remaining_qty, expected_date, rate, amount)
           VALUES (:po_number, :po_date, :status, :vendor, :sku, :ordered_qty, :received_qty, :remaining_qty, :expected_date, :rate, :amount)""",
        records,
    )
    conn.commit()
    conn.close()

    return len(records)


def run_full_sync():
    """Run full inventory + sales sync with status tracking."""
    try:
        sync_status.start()

        def progress(phase, pct, msg):
            sync_status.update(phase, pct, msg)

        sync_status.update("inventory", 0, "Syncing inventory from NetSuite...")
        inv_count = sync_inventory(progress_callback=progress)

        sync_status.update("sales", 40, "Syncing sales from NetSuite...")
        sales_count = sync_sales(progress_callback=progress)

        sync_status.update("purchase_orders", 85, "Syncing purchase orders from NetSuite...")
        po_count = sync_purchase_orders(progress_callback=progress)

        sync_status.update("cloud", 98, "Uploading to cloud storage...")
        sync_to_cloud()

        sync_status.complete(
            f"Synced {inv_count:,} inventory items, {sales_count:,} new sales records, and {po_count:,} PO lines"
        )
    except Exception as e:
        sync_status.fail(str(e))
        raise


def run_sales_sync():
    """Run sales-only sync with status tracking."""
    try:
        sync_status.start()

        def progress(phase, pct, msg):
            sync_status.update(phase, pct, msg)

        sync_status.update("sales", 0, "Syncing sales from NetSuite...")
        sales_count = sync_sales(progress_callback=lambda phase, pct, msg: progress(phase, int(pct / 98 * 100), msg))

        sync_status.update("cloud", 98, "Uploading to cloud storage...")
        sync_to_cloud()

        sync_status.complete(f"Synced {sales_count:,} new sales records")
    except Exception as e:
        sync_status.fail(str(e))
        raise
