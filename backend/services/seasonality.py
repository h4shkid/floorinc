import pandas as pd
from database import get_connection
from config import SEASONALITY_CLAMP_MIN, SEASONALITY_CLAMP_MAX


def calculate_seasonality(window_days: int = 90) -> pd.DataFrame:
    """
    YoY seasonal factor per SKU.
    Compares the NEXT `window_days` from last year vs the PRIOR `window_days` from last year.
    If next period had more sales → factor > 1.0 (ramp up expected).
    """
    conn = get_connection()

    # Last year's "prior" period: same trailing window but shifted back 1 year
    prior_query = """
        SELECT sku, SUM(quantity) as prior_qty
        FROM sales
        WHERE order_date BETWEEN date('now', '-1 year', ?) AND date('now', '-1 year')
          AND item_revenue > 0
        GROUP BY sku
    """

    # Last year's "next" period: the coming window shifted back 1 year
    next_query = """
        SELECT sku, SUM(quantity) as next_qty
        FROM sales
        WHERE order_date BETWEEN date('now', '-1 year') AND date('now', '-1 year', ?)
          AND item_revenue > 0
        GROUP BY sku
    """

    prior_df = pd.read_sql_query(prior_query, conn, params=[f"-{window_days} days"])
    next_df = pd.read_sql_query(next_query, conn, params=[f"+{window_days} days"])
    conn.close()

    if prior_df.empty or next_df.empty:
        # No historical data — return neutral factor
        return pd.DataFrame(columns=["sku", "seasonality_factor"])

    merged = prior_df.merge(next_df, on="sku", how="outer").fillna(0)

    # Avoid division by zero: if prior was 0 but next had sales, factor = clamp max
    merged["seasonality_factor"] = merged.apply(
        lambda r: (r["next_qty"] / r["prior_qty"]) if r["prior_qty"] > 0 else (SEASONALITY_CLAMP_MAX if r["next_qty"] > 0 else 1.0),
        axis=1,
    )

    # Clamp
    merged["seasonality_factor"] = merged["seasonality_factor"].clip(SEASONALITY_CLAMP_MIN, SEASONALITY_CLAMP_MAX)

    return merged[["sku", "seasonality_factor"]]
