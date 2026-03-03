import pandas as pd
from database import get_connection


def calculate_velocities(window_days: int = 90) -> pd.DataFrame:
    """Calculate sales velocity (units/day) for each SKU over trailing N days."""
    conn = get_connection()

    query = """
        SELECT sku, SUM(quantity) as total_qty, COUNT(DISTINCT order_date) as active_days,
               COALESCE(SUM(item_revenue), 0) as total_revenue
        FROM sales
        WHERE order_date >= date('now', ?)
          AND item_revenue > 0
        GROUP BY sku
    """
    df = pd.read_sql_query(query, conn, params=[f"-{window_days} days"])
    conn.close()

    df["velocity"] = df["total_qty"] / window_days
    df = df.rename(columns={"total_qty": "total_sold"})
    return df[["sku", "total_sold", "velocity", "total_revenue"]]


def get_top_channels() -> pd.DataFrame:
    """Get the dominant sales channel per SKU (last 90 days)."""
    conn = get_connection()
    query = """
        SELECT sku, channel, SUM(quantity) as qty
        FROM sales
        WHERE order_date >= date('now', '-90 days')
          AND item_revenue > 0
          AND channel IS NOT NULL
        GROUP BY sku, channel
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    if df.empty:
        return pd.DataFrame(columns=["sku", "top_channel"])

    idx = df.groupby("sku")["qty"].idxmax()
    result = df.loc[idx, ["sku", "channel"]].rename(columns={"channel": "top_channel"})
    return result


def get_product_categories() -> pd.DataFrame:
    """Get the most common product category per SKU."""
    conn = get_connection()
    query = """
        SELECT sku, product_category, COUNT(*) as cnt
        FROM sales
        WHERE product_category IS NOT NULL
          AND item_revenue > 0
        GROUP BY sku, product_category
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    if df.empty:
        return pd.DataFrame(columns=["sku", "product_category"])

    idx = df.groupby("sku")["cnt"].idxmax()
    return df.loc[idx, ["sku", "product_category"]]
