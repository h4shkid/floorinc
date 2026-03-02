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
):
    df = build_forecast(velocity_window, active_only=active_only)

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
def get_sku_detail(sku: str):
    # Get forecast row for this SKU
    df = build_forecast(90, active_only=False)
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
        WHERE sku = ? AND order_date >= ?
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
        WHERE sku = ? AND order_date >= ?
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
        WHERE sku = ?
        ORDER BY order_date DESC
        LIMIT 20
        """,
        (sku,),
    ).fetchall()
    recent_orders = [
        RecentOrder(date=o["date"], quantity=int(o["quantity"]), channel=o["channel"], revenue=round(o["revenue"], 2))
        for o in order_rows
    ]

    # 90-day financials
    ninety_days_ago = (date.today() - timedelta(days=90)).strftime("%Y-%m-%d")
    fin = conn.execute(
        """
        SELECT COALESCE(SUM(item_revenue), 0) AS revenue,
               COALESCE(SUM(product_cost * quantity), 0) AS cost
        FROM sales
        WHERE sku = ? AND order_date >= ?
        """,
        (sku, ninety_days_ago),
    ).fetchone()

    # AI insight
    insight_row = conn.execute(
        "SELECT insight, generated_at FROM sku_insights WHERE sku = ?", (sku,)
    ).fetchone()
    ai_insight = insight_row["insight"] if insight_row else None
    insight_generated_at = insight_row["generated_at"] if insight_row else None

    conn.close()

    total_revenue = round(fin["revenue"], 2)
    total_cost = round(fin["cost"], 2)
    margin = round((total_revenue - total_cost) / total_revenue * 100, 1) if total_revenue > 0 else None

    return SKUDetailResponse(
        sku=r["sku"],
        display_name=r["display_name"],
        on_hand=int(r["on_hand"]),
        urgency=r["urgency"],
        lead_time_days=int(r["lead_time_days"]),
        velocity=_safe_float(r["velocity"], 3) or 0.0,
        seasonality_factor=_safe_float(r["seasonality_factor"], 2) or 1.0,
        adjusted_velocity=_safe_float(r["adjusted_velocity"], 3) or 0.0,
        days_remaining=_safe_float(r["days_remaining"], 1),
        product_category=r["product_category"] or None,
        manufacturer=r["manufacturer"] or None,
        monthly_sales=monthly_sales,
        channel_breakdown=channel_breakdown,
        recent_orders=recent_orders,
        total_revenue_90d=total_revenue,
        total_cost_90d=total_cost,
        margin_90d=margin,
        ai_insight=ai_insight,
        insight_generated_at=insight_generated_at,
    )
