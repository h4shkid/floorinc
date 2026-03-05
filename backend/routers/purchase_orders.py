from datetime import datetime, timedelta
from fastapi import APIRouter, Query
from models import POListItem, POLineItem, VendorSummary, TimelineWeek
from database import get_connection

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


@router.get("/summary", response_model=list[VendorSummary])
def vendor_summary():
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            COALESCE(vendor, 'Unknown') as vendor,
            COUNT(DISTINCT po_number) as total_pos,
            SUM(remaining_qty) as total_remaining_qty,
            SUM(amount) as total_amount,
            MIN(CASE WHEN remaining_qty > 0 AND expected_date IS NOT NULL AND expected_date != '' THEN expected_date END) as nearest_expected
        FROM purchase_orders
        WHERE remaining_qty > 0
        GROUP BY COALESCE(vendor, 'Unknown')
        ORDER BY SUM(amount) DESC
    """).fetchall()
    conn.close()
    return [VendorSummary(
        vendor=r["vendor"],
        total_pos=r["total_pos"],
        total_remaining_qty=r["total_remaining_qty"] or 0,
        total_amount=r["total_amount"] or 0,
        nearest_expected=r["nearest_expected"],
    ) for r in rows]


@router.get("/timeline", response_model=list[TimelineWeek])
def delivery_timeline():
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            expected_date,
            remaining_qty,
            amount,
            po_number
        FROM purchase_orders
        WHERE remaining_qty > 0
            AND expected_date IS NOT NULL
            AND expected_date != ''
    """).fetchall()
    conn.close()

    weeks: dict[str, dict] = {}
    for r in rows:
        try:
            dt = datetime.strptime(r["expected_date"][:10], "%Y-%m-%d")
        except (ValueError, TypeError):
            continue
        # Monday of that week
        monday = dt - timedelta(days=dt.weekday())
        key = monday.strftime("%Y-%m-%d")
        if key not in weeks:
            weeks[key] = {"qty": 0, "amount": 0.0, "po_numbers": set()}
        weeks[key]["qty"] += r["remaining_qty"] or 0
        weeks[key]["amount"] += r["amount"] or 0
        weeks[key]["po_numbers"].add(r["po_number"])

    result = []
    for week_key in sorted(weeks.keys()):
        w = weeks[week_key]
        result.append(TimelineWeek(
            week=week_key,
            qty=w["qty"],
            amount=w["amount"],
            po_count=len(w["po_numbers"]),
        ))
    return result


@router.get("/{po_number}", response_model=list[POLineItem])
def get_po_lines(po_number: str):
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            po.sku,
            COALESCE(i.display_name, po.sku) as display_name,
            po.ordered_qty,
            po.received_qty,
            po.remaining_qty,
            po.expected_date,
            po.rate,
            po.amount,
            po.status
        FROM purchase_orders po
        LEFT JOIN inventory i ON po.sku = i.sku
        WHERE po.po_number = ?
        ORDER BY po.sku
    """, (po_number,)).fetchall()
    conn.close()
    return [POLineItem(
        sku=r["sku"],
        display_name=r["display_name"],
        ordered_qty=r["ordered_qty"],
        received_qty=r["received_qty"],
        remaining_qty=r["remaining_qty"],
        expected_date=r["expected_date"],
        rate=r["rate"] or 0,
        amount=r["amount"] or 0,
        status=r["status"],
    ) for r in rows]


@router.get("", response_model=list[POListItem])
def list_purchase_orders(
    search: str = Query("", description="Search PO#, vendor, or SKU"),
    vendor: str = Query("", description="Filter by vendor"),
):
    conn = get_connection()

    where_clauses = ["remaining_qty > 0"]
    params: list = []

    if vendor:
        where_clauses.append("vendor = ?")
        params.append(vendor)

    if search:
        where_clauses.append(
            "(po_number LIKE ? OR vendor LIKE ? OR sku LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like])

    # First find matching PO numbers
    if search:
        po_filter_sql = f"""
            SELECT DISTINCT po_number FROM purchase_orders
            WHERE {' AND '.join(where_clauses)}
        """
        po_numbers = [r["po_number"] for r in conn.execute(po_filter_sql, params).fetchall()]
        if not po_numbers:
            conn.close()
            return []
        placeholders = ",".join("?" * len(po_numbers))
        main_where = f"po_number IN ({placeholders})"
        main_params = po_numbers
    else:
        # For non-search queries, aggregate only open POs
        base_where = " AND ".join(where_clauses)
        po_filter_sql = f"SELECT DISTINCT po_number FROM purchase_orders WHERE {base_where}"
        po_numbers = [r["po_number"] for r in conn.execute(po_filter_sql, params).fetchall()]
        if not po_numbers:
            conn.close()
            return []
        placeholders = ",".join("?" * len(po_numbers))
        main_where = f"po_number IN ({placeholders})"
        main_params = po_numbers

    rows = conn.execute(f"""
        SELECT
            po_number,
            MIN(po_date) as po_date,
            MIN(status) as status,
            MIN(vendor) as vendor,
            COUNT(*) as total_lines,
            SUM(ordered_qty) as total_ordered_qty,
            SUM(received_qty) as total_received_qty,
            SUM(remaining_qty) as total_remaining_qty,
            SUM(amount) as total_amount,
            MIN(CASE WHEN expected_date IS NOT NULL AND expected_date != '' THEN expected_date END) as earliest_expected,
            MAX(CASE WHEN expected_date IS NOT NULL AND expected_date != '' THEN expected_date END) as latest_expected
        FROM purchase_orders
        WHERE {main_where}
        GROUP BY po_number
        ORDER BY MIN(po_date) DESC
    """, main_params).fetchall()
    conn.close()

    return [POListItem(
        po_number=r["po_number"],
        po_date=r["po_date"],
        status=r["status"],
        vendor=r["vendor"],
        total_lines=r["total_lines"],
        total_ordered_qty=r["total_ordered_qty"] or 0,
        total_received_qty=r["total_received_qty"] or 0,
        total_remaining_qty=r["total_remaining_qty"] or 0,
        total_amount=r["total_amount"] or 0,
        earliest_expected=r["earliest_expected"],
        latest_expected=r["latest_expected"],
    ) for r in rows]
