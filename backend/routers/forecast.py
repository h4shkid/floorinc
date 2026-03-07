import math
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query
from models import (
    ForecastItem,
    ForecastSummary,
    DashboardResponse,
    DashboardTotals,
    MonthlySales,
    ChannelBreakdown,
    RecentOrder,
    SKUDetailResponse,
    PurchaseOrderLine,
)
from database import get_connection
from services.forecast_engine import build_forecast


def _safe_float(val, decimals=1):
    """Safely round a float, returning None for NaN/None."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return round(val, decimals)

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/data-stats")
def get_data_stats():
    conn = get_connection()
    inv_count = conn.execute("SELECT COUNT(*) FROM inventory WHERE is_sample = 0").fetchone()[0]
    sales_count = conn.execute("SELECT COUNT(*) FROM sales WHERE item_revenue > 0").fetchone()[0]
    sku_with_sales = conn.execute(
        "SELECT COUNT(DISTINCT sku) FROM sales WHERE item_revenue > 0"
    ).fetchone()[0]

    date_row = conn.execute(
        "SELECT MIN(order_date) as min_date, MAX(order_date) as max_date FROM sales WHERE item_revenue > 0"
    ).fetchone()
    min_date = date_row["min_date"]
    max_date = date_row["max_date"]

    channel_count = conn.execute(
        "SELECT COUNT(DISTINCT channel) FROM sales WHERE channel IS NOT NULL AND item_revenue > 0"
    ).fetchone()[0]

    conn.close()

    months = 0
    days = 0
    if min_date and max_date:
        from datetime import date as dt_date
        d1 = dt_date.fromisoformat(min_date)
        d2 = dt_date.fromisoformat(max_date)
        delta = d2 - d1
        days = delta.days
        months = round(days / 30.44)

    return {
        "inventory_skus": inv_count,
        "total_transactions": sales_count,
        "skus_with_sales": sku_with_sales,
        "channels": channel_count,
        "date_from": min_date,
        "date_to": max_date,
        "months": months,
        "days": days,
    }


@router.get("/manufacturers", response_model=list[str])
def get_manufacturers():
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT manufacturer FROM inventory WHERE manufacturer != '' ORDER BY manufacturer"
    ).fetchall()
    conn.close()
    return [r["manufacturer"] for r in rows]


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("priority_score"),
    sort_dir: str = Query("asc"),
    search: str = Query("", description="Search SKU or display name"),
    urgency: str = Query("", description="RED,YELLOW,GREEN filter"),
    channel: str = Query("", description="Channel filter"),
    category: str = Query("", description="Product category filter"),
    manufacturer: str = Query("", description="Manufacturer/vendor filter"),
    velocity_window: int = Query(90, ge=7, le=365),
    active_only: bool = Query(True, description="Only show SKUs with sales activity"),
    stock_filter: str = Query("warehoused", description="warehoused|warehoused_domestic|warehoused_international|drop_ship|all"),
):
    df = build_forecast(velocity_window, active_only=active_only)

    # Stock type filter — warehoused views exclude confirmed drop ship items
    if stock_filter == "warehoused":
        df = df[df["is_drop_ship"] != 1]
    elif stock_filter == "warehoused_domestic":
        df = df[(df["is_drop_ship"] != 1) & (df["source_type"] == "Domestic")]
    elif stock_filter == "warehoused_international":
        df = df[(df["is_drop_ship"] != 1) & (df["source_type"] == "International")]
    elif stock_filter == "drop_ship":
        df = df[df["is_drop_ship"] == 1]
    # "all" = no filter

    # Filters
    if search:
        mask = (
            df["sku"].str.contains(search, case=False, na=False)
            | df["display_name"].str.contains(search, case=False, na=False)
            | df["manufacturer"].str.contains(search, case=False, na=False)
        )
        df = df[mask]

    if urgency:
        urgencies = [u.strip().upper() for u in urgency.split(",")]
        df = df[df["urgency"].isin(urgencies)]

    if channel:
        df = df[df["top_channel"].str.contains(channel, case=False, na=False)]

    if category:
        df = df[df["product_category"].str.contains(category, case=False, na=False)]

    if manufacturer:
        df = df[df["manufacturer"].str.contains(manufacturer, case=False, na=False)]

    # Summary (after filters)
    summary = ForecastSummary(
        backorder=int((df["urgency"] == "BACKORDER").sum()),
        red=int((df["urgency"] == "RED").sum()),
        yellow=int((df["urgency"] == "YELLOW").sum()),
        green=int((df["urgency"] == "GREEN").sum()),
        total_skus=len(df),
    )

    # Sort
    ascending = sort_dir.lower() == "asc"
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=ascending, na_position="last")

    # Paginate
    total = len(df)
    start = (page - 1) * page_size
    page_df = df.iloc[start : start + page_size]

    items = [
        ForecastItem(
            sku=r["sku"],
            display_name=r["display_name"],
            on_hand=int(r["on_hand"]),
            available_qty=int(r["available_qty"]),
            velocity=_safe_float(r["velocity"], 3) or 0.0,
            seasonality_factor=_safe_float(r["seasonality_factor"], 2) or 1.0,
            adjusted_velocity=_safe_float(r["adjusted_velocity"], 3) or 0.0,
            days_remaining=_safe_float(r["days_remaining"], 1),
            lead_time_days=int(r["lead_time_days"]),
            urgency=r["urgency"],
            priority_score=_safe_float(r["priority_score"], 1) or 0.0,
            product_category=r["product_category"] or None,
            top_channel=r["top_channel"] or None,
            total_sold_90d=int(r["total_sold_90d"]),
            total_revenue_90d=round(r.get("total_revenue_90d", 0) or 0, 2),
            manufacturer=r["manufacturer"] or None,
            item_cost=_safe_float(r.get("item_cost", 0), 2) or 0.0,
            qty_on_order=int(r.get("qty_on_order", 0)),
            qty_committed=int(r.get("qty_committed", 0)),
            incoming_qty=int(r.get("incoming_qty", 0)),
            is_drop_ship=int(r.get("is_drop_ship", 0)),
        )
        for _, r in page_df.iterrows()
    ]

    totals = DashboardTotals(
        on_hand=int(df["on_hand"].sum()),
        total_sold_90d=int(df["total_sold_90d"].sum()),
        total_revenue_90d=round(float(df["total_revenue_90d"].sum()), 2),
    )

    return DashboardResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        summary=summary,
        totals=totals,
    )


@router.get("/summary", response_model=ForecastSummary)
def get_summary(velocity_window: int = Query(90, ge=7, le=365)):
    df = build_forecast(velocity_window)
    return ForecastSummary(
        backorder=int((df["urgency"] == "BACKORDER").sum()),
        red=int((df["urgency"] == "RED").sum()),
        yellow=int((df["urgency"] == "YELLOW").sum()),
        green=int((df["urgency"] == "GREEN").sum()),
        total_skus=len(df),
    )


@router.get("/{sku}/detail", response_model=SKUDetailResponse)
def get_sku_detail(sku: str, velocity_window: int = Query(90, ge=7, le=365)):
    # Get forecast row for this SKU
    df = build_forecast(velocity_window, active_only=False)
    row = df[df["sku"] == sku]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"SKU not found: {sku}")
    r = row.iloc[0]

    conn = get_connection()

    # Monthly sales — last 12 months
    twelve_months_ago = (date.today().replace(day=1) - timedelta(days=365)).strftime("%Y-%m-01")
    monthly_rows = conn.execute(
        """
        SELECT strftime('%Y-%m', order_date) AS month,
               SUM(quantity) AS quantity,
               COALESCE(SUM(item_revenue), 0) AS revenue
        FROM sales
        WHERE sku = ? AND order_date >= ? AND item_revenue > 0
        GROUP BY month
        ORDER BY month
        """,
        (sku, twelve_months_ago),
    ).fetchall()
    monthly_sales = [
        MonthlySales(month=m["month"], quantity=int(m["quantity"]), revenue=round(m["revenue"], 2))
        for m in monthly_rows
    ]

    # Channel breakdown — last 12 months
    channel_rows = conn.execute(
        """
        SELECT COALESCE(channel, 'Unknown') AS channel,
               SUM(quantity) AS quantity,
               COALESCE(SUM(item_revenue), 0) AS revenue
        FROM sales
        WHERE sku = ? AND order_date >= ? AND item_revenue > 0
        GROUP BY channel
        ORDER BY quantity DESC
        """,
        (sku, twelve_months_ago),
    ).fetchall()
    channel_breakdown = [
        ChannelBreakdown(channel=c["channel"], quantity=int(c["quantity"]), revenue=round(c["revenue"], 2))
        for c in channel_rows
    ]

    # Recent orders — last 20
    order_rows = conn.execute(
        """
        SELECT order_date AS date,
               quantity,
               channel,
               COALESCE(item_revenue, 0) AS revenue
        FROM sales
        WHERE sku = ? AND item_revenue > 0
        ORDER BY order_date DESC
        LIMIT 20
        """,
        (sku,),
    ).fetchall()
    recent_orders = [
        RecentOrder(date=o["date"], quantity=int(o["quantity"]), channel=o["channel"], revenue=round(o["revenue"], 2))
        for o in order_rows
    ]

    # Financials for the selected velocity window
    window_start = (date.today() - timedelta(days=velocity_window)).strftime("%Y-%m-%d")
    fin = conn.execute(
        """
        SELECT COALESCE(SUM(item_revenue), 0) AS revenue,
               COALESCE(SUM(quantity), 0) AS qty_sold
        FROM sales
        WHERE sku = ? AND order_date >= ? AND item_revenue > 0
        """,
        (sku, window_start),
    ).fetchone()

    # Purchase orders
    po_rows = conn.execute(
        """SELECT po_number, po_date, status, vendor, ordered_qty, received_qty,
                  remaining_qty, expected_date, rate, amount
           FROM purchase_orders WHERE sku = ? ORDER BY expected_date""",
        (sku,),
    ).fetchall()
    purchase_orders = [
        PurchaseOrderLine(
            po_number=p["po_number"],
            po_date=p["po_date"],
            status=p["status"],
            vendor=p["vendor"],
            ordered_qty=int(p["ordered_qty"]),
            received_qty=int(p["received_qty"]),
            remaining_qty=int(p["remaining_qty"]),
            expected_date=p["expected_date"],
            rate=float(p["rate"] or 0),
            amount=float(p["amount"] or 0),
        )
        for p in po_rows
    ]
    incoming_qty = sum(p.remaining_qty for p in purchase_orders)

    # AI insight
    insight_row = conn.execute(
        "SELECT insight, generated_at FROM sku_insights WHERE sku = ?", (sku,)
    ).fetchone()
    ai_insight = insight_row["insight"] if insight_row else None
    insight_generated_at = insight_row["generated_at"] if insight_row else None

    conn.close()

    total_revenue = round(fin["revenue"], 2)
    item_cost = float(r.get("item_cost", 0) or 0)
    qty_sold_90d = int(fin["qty_sold"])
    total_cost = round(item_cost * qty_sold_90d, 2) if item_cost > 0 else 0.0
    margin = round((total_revenue - total_cost) / total_revenue * 100, 1) if total_revenue > 0 and total_cost > 0 else None

    available_qty = int(r["available_qty"])

    return SKUDetailResponse(
        sku=r["sku"],
        display_name=r["display_name"],
        on_hand=int(r["on_hand"]),
        available_qty=available_qty,
        urgency=r["urgency"],
        lead_time_days=int(r["lead_time_days"]),
        velocity=_safe_float(r["velocity"], 3) or 0.0,
        seasonality_factor=_safe_float(r["seasonality_factor"], 2) or 1.0,
        adjusted_velocity=_safe_float(r["adjusted_velocity"], 3) or 0.0,
        days_remaining=_safe_float(r["days_remaining"], 1),
        product_category=r["product_category"] or None,
        manufacturer=r["manufacturer"] or None,
        item_cost=_safe_float(r.get("item_cost", 0), 2) or 0.0,
        qty_on_order=int(r.get("qty_on_order", 0)),
        qty_committed=int(r.get("qty_committed", 0)),
        incoming_qty=incoming_qty,
        net_after_receipt=available_qty + incoming_qty,
        monthly_sales=monthly_sales,
        channel_breakdown=channel_breakdown,
        recent_orders=recent_orders,
        purchase_orders=purchase_orders,
        total_revenue_90d=total_revenue,
        total_cost_90d=total_cost,
        margin_90d=margin,
        ai_insight=ai_insight,
        insight_generated_at=insight_generated_at,
    )
