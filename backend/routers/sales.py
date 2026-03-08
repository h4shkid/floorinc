from datetime import date, timedelta
from fastapi import APIRouter, Query
from models import (
    SalesKPIs,
    SalesMonthlyTrend,
    SalesChannelPerformance,
    SalesTopSKU,
    SalesCategoryPerformance,
    SalesAnalyticsResponse,
)
from database import get_connection

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.get("/analytics", response_model=SalesAnalyticsResponse)
def sales_analytics(
    months: int = Query(12, ge=1, le=36, description="Number of months lookback"),
    channel: str = Query("", description="Filter by channel"),
):
    conn = get_connection()
    cutoff = (date.today().replace(day=1) - timedelta(days=months * 30)).strftime(
        "%Y-%m-01"
    )

    channel_clause = ""
    params_base: list = [cutoff]
    if channel:
        channel_clause = " AND channel = ?"
        params_base.append(channel)

    # --- Query 1: KPIs ---
    kpi_row = conn.execute(
        f"""
        SELECT
            COALESCE(SUM(item_revenue), 0) as total_revenue,
            COUNT(*) as total_orders,
            COALESCE(SUM(quantity), 0) as total_units,
            COALESCE(SUM(product_cost * quantity), 0) as total_cost
        FROM sales
        WHERE order_date >= ? AND item_revenue > 0{channel_clause}
    """,
        params_base,
    ).fetchone()

    total_revenue = kpi_row["total_revenue"]
    total_orders = kpi_row["total_orders"]
    total_cost = kpi_row["total_cost"]
    avg_order_value = (
        round(total_revenue / total_orders, 2) if total_orders > 0 else 0
    )
    gross_margin = (
        round((total_revenue - total_cost) / total_revenue * 100, 1)
        if total_revenue > 0 and total_cost > 0
        else None
    )

    # --- Query 2: Prior period for trend comparison ---
    prior_cutoff = (
        date.today().replace(day=1) - timedelta(days=months * 2 * 30)
    ).strftime("%Y-%m-01")
    prior_params: list = [prior_cutoff, cutoff]
    if channel:
        prior_params.append(channel)
    prior_row = conn.execute(
        f"""
        SELECT COALESCE(SUM(item_revenue), 0) as prior_revenue
        FROM sales
        WHERE order_date >= ? AND order_date < ? AND item_revenue > 0{channel_clause}
    """,
        prior_params,
    ).fetchone()
    prior_revenue = prior_row["prior_revenue"]
    revenue_trend = (
        round((total_revenue - prior_revenue) / prior_revenue * 100, 1)
        if prior_revenue > 0
        else None
    )

    kpis = SalesKPIs(
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        total_units=kpi_row["total_units"],
        avg_order_value=avg_order_value,
        total_cost=round(total_cost, 2),
        gross_margin_pct=gross_margin,
        revenue_trend=revenue_trend,
    )

    # --- Query 3: Monthly trend ---
    monthly_rows = conn.execute(
        f"""
        SELECT
            strftime('%Y-%m', order_date) as month,
            COALESCE(SUM(item_revenue), 0) as revenue,
            COUNT(*) as orders,
            COALESCE(SUM(quantity), 0) as units,
            COALESCE(SUM(product_cost * quantity), 0) as cost
        FROM sales
        WHERE order_date >= ? AND item_revenue > 0{channel_clause}
        GROUP BY strftime('%Y-%m', order_date)
        ORDER BY month
    """,
        params_base,
    ).fetchall()
    monthly_trend = [
        SalesMonthlyTrend(
            month=m["month"],
            revenue=round(m["revenue"], 2),
            orders=m["orders"],
            units=m["units"],
            cost=round(m["cost"], 2),
        )
        for m in monthly_rows
    ]

    # --- Query 4: Channel performance (ignores channel filter) ---
    channel_rows = conn.execute(
        """
        SELECT
            COALESCE(channel, 'Unknown') as channel,
            COALESCE(SUM(item_revenue), 0) as revenue,
            COUNT(*) as orders,
            COALESCE(SUM(quantity), 0) as units
        FROM sales
        WHERE order_date >= ? AND item_revenue > 0
        GROUP BY COALESCE(channel, 'Unknown')
        ORDER BY revenue DESC
    """,
        [cutoff],
    ).fetchall()
    channel_performance = [
        SalesChannelPerformance(
            channel=c["channel"],
            revenue=round(c["revenue"], 2),
            orders=c["orders"],
            units=c["units"],
            revenue_pct=(
                round(c["revenue"] / total_revenue * 100, 1)
                if total_revenue > 0
                else 0
            ),
        )
        for c in channel_rows
    ]

    # --- Query 5: Top SKUs (limit 20) ---
    top_sku_rows = conn.execute(
        f"""
        SELECT
            s.sku,
            MAX(COALESCE(i.display_name, s.product_name, s.sku)) as display_name,
            COALESCE(SUM(s.item_revenue), 0) as revenue,
            COALESCE(SUM(s.quantity), 0) as units,
            COUNT(*) as orders,
            COALESCE(SUM(s.product_cost * s.quantity), 0) as cost,
            (SELECT s2.channel FROM sales s2
             WHERE s2.sku = s.sku AND s2.order_date >= ? AND s2.item_revenue > 0
             GROUP BY s2.channel ORDER BY SUM(s2.item_revenue) DESC LIMIT 1) as top_channel
        FROM sales s
        LEFT JOIN inventory i ON s.sku = i.sku
        WHERE s.order_date >= ? AND s.item_revenue > 0{channel_clause}
        GROUP BY s.sku
        ORDER BY revenue DESC
        LIMIT 20
    """,
        [cutoff] + params_base,
    ).fetchall()
    top_skus = [
        SalesTopSKU(
            sku=t["sku"],
            display_name=t["display_name"],
            revenue=round(t["revenue"], 2),
            units=t["units"],
            orders=t["orders"],
            margin_pct=(
                round((t["revenue"] - t["cost"]) / t["revenue"] * 100, 1)
                if t["revenue"] > 0 and t["cost"] > 0
                else None
            ),
            top_channel=t["top_channel"],
        )
        for t in top_sku_rows
    ]

    # --- Query 6: Category performance ---
    cat_rows = conn.execute(
        f"""
        SELECT
            COALESCE(product_category, 'Uncategorized') as category,
            COALESCE(SUM(item_revenue), 0) as revenue,
            COALESCE(SUM(quantity), 0) as units,
            COUNT(*) as orders
        FROM sales
        WHERE order_date >= ? AND item_revenue > 0{channel_clause}
        GROUP BY COALESCE(product_category, 'Uncategorized')
        ORDER BY revenue DESC
    """,
        params_base,
    ).fetchall()
    category_performance = [
        SalesCategoryPerformance(
            category=c["category"],
            revenue=round(c["revenue"], 2),
            units=c["units"],
            orders=c["orders"],
        )
        for c in cat_rows
    ]

    # --- Date range ---
    date_range = conn.execute(
        f"""
        SELECT MIN(order_date) as date_from, MAX(order_date) as date_to
        FROM sales
        WHERE order_date >= ? AND item_revenue > 0{channel_clause}
    """,
        params_base,
    ).fetchone()

    conn.close()

    return SalesAnalyticsResponse(
        kpis=kpis,
        monthly_trend=monthly_trend,
        channel_performance=channel_performance,
        top_skus=top_skus,
        category_performance=category_performance,
        date_from=date_range["date_from"],
        date_to=date_range["date_to"],
    )
