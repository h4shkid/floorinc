import math
import pandas as pd
from database import get_connection
from config import DEFAULT_LEAD_TIME_DAYS
from services.velocity_calculator import calculate_velocities, get_top_channels, get_product_categories
from services.seasonality import calculate_seasonality


def build_forecast(velocity_window: int = 90, active_only: bool = True) -> pd.DataFrame:
    """
    Build the full forecast table:
    1. Get inventory (exclude samples)
    2. Calculate velocity per SKU
    3. Apply seasonality factor
    4. Compute days_remaining & urgency
    5. Sort by priority (most urgent first)
    """
    conn = get_connection()

    # 1. Inventory (non-sample)
    inv_df = pd.read_sql_query(
        "SELECT sku, display_name, on_hand, manufacturer, item_cost, qty_on_order, qty_committed, is_drop_ship, is_warehoused, source_type FROM inventory WHERE is_sample = 0",
        conn,
    )

    # Lead times
    lt_df = pd.read_sql_query("SELECT sku, lead_time_days FROM lead_times", conn)

    # Incoming PO quantities
    po_df = pd.read_sql_query(
        "SELECT sku, SUM(remaining_qty) AS incoming_qty FROM purchase_orders GROUP BY sku",
        conn,
    )
    conn.close()

    # 2. Velocity
    vel_df = calculate_velocities(velocity_window)

    # 3. Seasonality
    seas_df = calculate_seasonality(velocity_window)

    # 4. Top channel + category
    chan_df = get_top_channels()
    cat_df = get_product_categories()

    # Merge everything onto inventory
    df = inv_df.merge(vel_df[["sku", "total_sold", "velocity", "total_revenue"]], on="sku", how="left")
    df = df.merge(seas_df, on="sku", how="left")
    df = df.merge(lt_df, on="sku", how="left")
    df = df.merge(chan_df, on="sku", how="left")
    df = df.merge(cat_df, on="sku", how="left")
    df = df.merge(po_df, on="sku", how="left")

    # Filter to only SKUs with sales history (active products)
    if active_only:
        has_sales = df["velocity"].notna() & (df["velocity"] > 0)
        has_backorder = df["on_hand"] < 0
        df = df[has_sales | has_backorder].copy()

    # Fill defaults
    df["velocity"] = df["velocity"].fillna(0.0)
    df["total_sold"] = df["total_sold"].fillna(0).astype(int)
    df["total_revenue"] = df["total_revenue"].fillna(0.0)
    df["seasonality_factor"] = df["seasonality_factor"].fillna(1.0)
    df["lead_time_days"] = df["lead_time_days"].fillna(DEFAULT_LEAD_TIME_DAYS).astype(int)
    df["top_channel"] = df["top_channel"].fillna("")
    df["product_category"] = df["product_category"].fillna("")
    df["manufacturer"] = df["manufacturer"].fillna("")
    df["item_cost"] = df["item_cost"].fillna(0.0)
    df["qty_on_order"] = df["qty_on_order"].fillna(0).astype(int)
    df["qty_committed"] = df["qty_committed"].fillna(0).astype(int)
    df["incoming_qty"] = df["incoming_qty"].fillna(0).astype(int)
    df["is_drop_ship"] = df["is_drop_ship"].fillna(0).astype(int)
    df["is_warehoused"] = df["is_warehoused"].fillna(0).astype(int)
    df["source_type"] = df["source_type"].fillna("")

    # 5. Available qty (on_hand minus committed), adjusted velocity & days remaining
    df["available_qty"] = df["on_hand"] - df["qty_committed"]
    df["adjusted_velocity"] = df["velocity"] * df["seasonality_factor"]
    df["days_remaining"] = df.apply(
        lambda r: (r["available_qty"] / r["adjusted_velocity"]) if r["adjusted_velocity"] > 0 else None,
        axis=1,
    )

    # Replace NaN with None for days_remaining
    df["days_remaining"] = df["days_remaining"].where(df["days_remaining"].notna(), None)

    # 6. Urgency classification
    def classify(row):
        # Negative available qty = backorder → separate category
        if row["available_qty"] < 0:
            return "BACKORDER"
        # Zero velocity with stock → GREEN (no sales, no urgency)
        if row["adjusted_velocity"] == 0:
            return "GREEN"
        dr = row["days_remaining"]
        if dr is None or (isinstance(dr, float) and math.isnan(dr)):
            return "GREEN"
        lt = row["lead_time_days"]
        if dr <= lt:
            return "RED"
        if dr <= lt * 1.5:
            return "YELLOW"
        return "GREEN"

    df["urgency"] = df.apply(classify, axis=1)

    # 7. Priority score (lower = more urgent)
    def _safe_dr(val):
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return 999999.0
        return float(val)

    def priority(row):
        base = _safe_dr(row["days_remaining"])
        if row["urgency"] == "BACKORDER":
            return -1000 + row["available_qty"]  # More negative = higher priority
        if row["urgency"] == "RED":
            return base
        if row["urgency"] == "YELLOW":
            return 10000 + base
        return 100000 + base

    df["priority_score"] = df.apply(priority, axis=1)
    df = df.sort_values("priority_score")

    # Rename for output
    df = df.rename(columns={"total_sold": "total_sold_90d", "total_revenue": "total_revenue_90d"})

    return df
