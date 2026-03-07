from datetime import datetime, timedelta
from fastapi import APIRouter, Query
from models import POListItem, POLineItem, VendorSummary, TimelineWeek, VendorScorecard, VendorPO, VendorSKU, MonthlySpend
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


@router.get("/vendor/{vendor}", response_model=VendorScorecard)
def vendor_scorecard(vendor: str):
    conn = get_connection()
    today = datetime.now().strftime("%Y-%m-%d")

    # Query 1: PO aggregates
    po_rows = conn.execute("""
        SELECT
            po_number,
            MIN(po_date) as po_date,
            MIN(status) as status,
            COUNT(*) as total_lines,
            SUM(ordered_qty) as total_ordered_qty,
            SUM(received_qty) as total_received_qty,
            SUM(remaining_qty) as total_remaining_qty,
            SUM(amount) as total_amount,
            MIN(CASE WHEN expected_date IS NOT NULL AND expected_date != '' THEN expected_date END) as earliest_expected,
            MAX(CASE WHEN expected_date IS NOT NULL AND expected_date != '' THEN expected_date END) as latest_expected
        FROM purchase_orders
        WHERE vendor = ? AND remaining_qty > 0
        GROUP BY po_number
        ORDER BY MIN(po_date) DESC
    """, (vendor,)).fetchall()

    purchase_orders = []
    late_pos = 0
    total_open_pos_with_date = 0
    remaining_units = 0
    total_on_order = 0.0

    for r in po_rows:
        remaining_units += r["total_remaining_qty"] or 0
        total_on_order += r["total_amount"] or 0
        earliest = r["earliest_expected"]
        if earliest:
            total_open_pos_with_date += 1
            if earliest < today and (r["total_remaining_qty"] or 0) > 0:
                late_pos += 1
        purchase_orders.append(VendorPO(
            po_number=r["po_number"],
            po_date=r["po_date"],
            status=r["status"],
            total_lines=r["total_lines"],
            total_ordered_qty=r["total_ordered_qty"] or 0,
            total_received_qty=r["total_received_qty"] or 0,
            total_remaining_qty=r["total_remaining_qty"] or 0,
            total_amount=r["total_amount"] or 0,
            earliest_expected=r["earliest_expected"],
            latest_expected=r["latest_expected"],
        ))

    late_percentage = round(late_pos / total_open_pos_with_date * 100, 1) if total_open_pos_with_date > 0 else 0.0

    # Query 2: SKU aggregates
    sku_rows = conn.execute("""
        SELECT
            po.sku,
            COALESCE(i.display_name, po.sku) as display_name,
            SUM(po.remaining_qty) as remaining_qty,
            SUM(po.ordered_qty) as total_ordered_qty,
            SUM(po.received_qty) as total_received_qty,
            COUNT(DISTINCT po.po_number) as po_count
        FROM purchase_orders po
        LEFT JOIN inventory i ON po.sku = i.sku
        WHERE po.vendor = ? AND po.remaining_qty > 0
        GROUP BY po.sku
        ORDER BY SUM(po.remaining_qty) DESC
    """, (vendor,)).fetchall()

    skus = [VendorSKU(
        sku=s["sku"],
        display_name=s["display_name"],
        remaining_qty=s["remaining_qty"] or 0,
        total_ordered_qty=s["total_ordered_qty"] or 0,
        total_received_qty=s["total_received_qty"] or 0,
        po_count=s["po_count"],
    ) for s in sku_rows]

    # Query 3: Monthly spend
    spend_rows = conn.execute("""
        SELECT
            SUBSTR(po_date, 1, 7) as month,
            SUM(amount) as amount,
            COUNT(DISTINCT po_number) as po_count
        FROM purchase_orders
        WHERE vendor = ? AND po_date IS NOT NULL AND po_date != ''
        GROUP BY SUBSTR(po_date, 1, 7)
        ORDER BY month DESC
        LIMIT 12
    """, (vendor,)).fetchall()

    monthly_spend = [MonthlySpend(
        month=s["month"],
        amount=s["amount"] or 0,
        po_count=s["po_count"],
    ) for s in reversed(spend_rows)]

    # Query 4: Avg lead time
    lt_row = conn.execute("""
        SELECT AVG(JULIANDAY(expected_date) - JULIANDAY(po_date)) as avg_lead_time
        FROM purchase_orders
        WHERE vendor = ?
            AND expected_date IS NOT NULL AND expected_date != ''
            AND po_date IS NOT NULL AND po_date != ''
            AND remaining_qty > 0
    """, (vendor,)).fetchone()

    avg_lead_time = round(lt_row["avg_lead_time"], 1) if lt_row and lt_row["avg_lead_time"] is not None else None

    conn.close()

    # Rating
    if total_open_pos_with_date == 0:
        rating = "Average"
    elif late_percentage <= 10:
        rating = "Good"
    elif late_percentage <= 30:
        rating = "Average"
    else:
        rating = "Poor"

    return VendorScorecard(
        vendor=vendor,
        rating=rating,
        open_pos=len(po_rows),
        remaining_units=remaining_units,
        total_on_order=round(total_on_order, 2),
        late_pos=late_pos,
        total_open_pos_with_date=total_open_pos_with_date,
        late_percentage=late_percentage,
        avg_lead_time_days=avg_lead_time,
        monthly_spend=monthly_spend,
        skus=skus,
        purchase_orders=purchase_orders,
    )


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
