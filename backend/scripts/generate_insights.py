"""Generate AI insights for active SKUs using local Ollama (qwen2.5:7b)."""
import argparse
import math
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests

# Add parent to path so we can import modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import get_connection, init_db
from services.forecast_engine import build_forecast

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5:7b"


def get_sku_detail_data(conn, sku: str) -> dict:
    """Gather sales detail for a single SKU (monthly, channels, financials)."""
    twelve_months_ago = (date.today().replace(day=1) - timedelta(days=365)).strftime("%Y-%m-01")
    ninety_days_ago = (date.today() - timedelta(days=90)).strftime("%Y-%m-%d")

    monthly = conn.execute(
        """
        SELECT strftime('%Y-%m', order_date) AS month,
               SUM(quantity) AS quantity,
               COALESCE(SUM(item_revenue), 0) AS revenue
        FROM sales WHERE sku = ? AND order_date >= ? AND item_revenue > 0
        GROUP BY month ORDER BY month
        """,
        (sku, twelve_months_ago),
    ).fetchall()

    channels = conn.execute(
        """
        SELECT COALESCE(channel, 'Unknown') AS channel,
               SUM(quantity) AS quantity,
               COALESCE(SUM(item_revenue), 0) AS revenue
        FROM sales WHERE sku = ? AND order_date >= ? AND item_revenue > 0
        GROUP BY channel ORDER BY quantity DESC
        """,
        (sku, twelve_months_ago),
    ).fetchall()

    fin = conn.execute(
        """
        SELECT COALESCE(SUM(item_revenue), 0) AS revenue,
               COALESCE(SUM(product_cost * quantity), 0) AS cost
        FROM sales WHERE sku = ? AND order_date >= ? AND item_revenue > 0
        """,
        (sku, ninety_days_ago),
    ).fetchone()

    return {
        "monthly_sales": [
            {"month": r["month"], "qty": int(r["quantity"]), "rev": round(r["revenue"], 2)}
            for r in monthly
        ],
        "channels": [
            {"channel": r["channel"], "qty": int(r["quantity"]), "rev": round(r["revenue"], 2)}
            for r in channels
        ],
        "revenue_90d": round(fin["revenue"], 2),
        "cost_90d": round(fin["cost"], 2),
    }


CHANNEL_MAP = {
    "FI": "FlooringInc.com (direct website)",
    "Amazon Vendor Central": "Amazon Vendor Central",
    "Amazon Seller Central": "Amazon Seller Central",
    "Home Depot": "Home Depot",
    "Wayfair": "Wayfair",
    "Walmart": "Walmart",
    "eBay": "eBay",
}


def _compute_trend(monthly_sales: list[dict]) -> str:
    """Compare last 3 months vs prior 3 months to get trend direction."""
    if len(monthly_sales) < 4:
        return "insufficient data"
    recent_3 = sum(m["qty"] for m in monthly_sales[-3:])
    prior_3 = sum(m["qty"] for m in monthly_sales[-6:-3]) if len(monthly_sales) >= 6 else sum(m["qty"] for m in monthly_sales[:-3])
    if prior_3 == 0:
        return "new product (no prior period)" if recent_3 > 0 else "no sales"
    change_pct = ((recent_3 - prior_3) / prior_3) * 100
    if change_pct > 20:
        return f"growing (+{change_pct:.0f}% vs prior period)"
    elif change_pct < -20:
        return f"declining ({change_pct:.0f}% vs prior period)"
    return f"stable ({change_pct:+.0f}% vs prior period)"


def build_prompt(row, detail: dict) -> str:
    """Build a structured prompt for the LLM with pre-computed derived metrics."""
    margin = (
        round((detail["revenue_90d"] - detail["cost_90d"]) / detail["revenue_90d"] * 100, 1)
        if detail["revenue_90d"] > 0
        else None
    )

    on_hand = int(row["on_hand"])
    lead_time = int(row["lead_time_days"])
    adj_vel = row["adjusted_velocity"]
    days_remaining = row["days_remaining"]
    if days_remaining is not None and (isinstance(days_remaining, float) and math.isnan(days_remaining)):
        days_remaining = None
    total_sold_90d = int(row["total_sold_90d"])

    # Derived metrics
    reorder_qty = round(adj_vel * lead_time) if adj_vel > 0 else 0
    stock_gap_days = (round(days_remaining - lead_time) if days_remaining is not None else None)
    trend = _compute_trend(detail["monthly_sales"])

    # Reorder status interpretation
    if on_hand < 0:
        reorder_status = f"CRITICAL — already backordered by {abs(on_hand)} units, reorder immediately"
    elif stock_gap_days is not None and stock_gap_days < 0:
        reorder_status = f"LATE — stock will run out {abs(stock_gap_days)} days BEFORE new order arrives"
    elif stock_gap_days is not None and stock_gap_days < 15:
        reorder_status = f"URGENT — only {stock_gap_days} days of buffer after lead time, reorder now"
    elif stock_gap_days is not None:
        reorder_status = f"OK — {stock_gap_days} days of buffer beyond lead time"
    else:
        reorder_status = "N/A — zero velocity"

    # Channel breakdown with mapped names
    channel_str = ", ".join(
        f"{CHANNEL_MAP.get(c['channel'], c['channel'])}: {c['qty']} units (${c['rev']:,.0f})"
        for c in detail["channels"]
    )
    top_channel_pct = None
    if detail["channels"]:
        total_ch_qty = sum(c["qty"] for c in detail["channels"])
        if total_ch_qty > 0:
            top_channel_pct = round(detail["channels"][0]["qty"] / total_ch_qty * 100)

    monthly_str = ", ".join(
        f"{m['month']}: {m['qty']} units (${m['rev']:,.0f})" for m in detail["monthly_sales"]
    )

    return f"""You are an inventory analyst for FlooringInc, a flooring distributor. Given the data below, write 2-3 sentences of actionable insight for the purchasing team.

Channel key: "FlooringInc.com" = the company's own direct-to-consumer website (NOT Amazon). "Amazon Vendor Central" / "Amazon Seller Central" = Amazon. Others are marketplace names.

=== SKU DATA ===
Product: {row['display_name']}
Category: {row.get('product_category', 'N/A')}

--- Stock & Velocity ---
On Hand: {on_hand} units
Sell-through Rate: {adj_vel:.2f} units/day (raw: {row['velocity']:.3f}/day × {row['seasonality_factor']:.2f}x seasonality)
Total Sold (90d): {total_sold_90d} units
Days of Stock Remaining: {f"{days_remaining:.0f}" if days_remaining is not None else "N/A (zero velocity)"}

--- Reorder Analysis ---
Lead Time: {lead_time} days (time from placing order to receiving stock)
Units Needed to Cover Lead Time: {reorder_qty} units
Buffer After Lead Time: {f"{stock_gap_days} days" if stock_gap_days is not None else "N/A"}
Reorder Status: {reorder_status}

--- Financials (90d) ---
Revenue: ${detail['revenue_90d']:,.2f}
Margin: {f"{margin}%" if margin is not None else "N/A"}

--- Trend ---
Direction: {trend}

--- Channel Breakdown (12mo) ---
{channel_str or 'No data'}{f" (top channel = {top_channel_pct}% of volume)" if top_channel_pct else ""}

--- Monthly Sales (12mo) ---
{monthly_str or 'No data'}

Based on this data, provide 2-3 sentences focusing on: what action to take (reorder urgency and quantity), the sales trend, and any risk (channel concentration, seasonality shifts). Be specific with numbers.

Insight:"""


def generate_insight(prompt: str, model: str) -> str:
    """Call Ollama API and return the generated text."""
    resp = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 200},
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["response"].strip()


def main():
    parser = argparse.ArgumentParser(description="Generate AI insights for active SKUs")
    parser.add_argument("--force", action="store_true", help="Regenerate all insights")
    parser.add_argument("--sku", type=str, help="Generate for a single SKU only")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help="Ollama model to use")
    args = parser.parse_args()

    init_db()
    conn = get_connection()

    # Get active SKUs from forecast engine
    df = build_forecast(90, active_only=True)
    print(f"Found {len(df)} active SKUs")

    # Filter to single SKU if specified
    if args.sku:
        df = df[df["sku"] == args.sku]
        if df.empty:
            print(f"SKU not found: {args.sku}")
            sys.exit(1)

    # Check which already have insights (skip unless --force)
    if not args.force:
        existing = {
            r["sku"]
            for r in conn.execute("SELECT sku FROM sku_insights").fetchall()
        }
        before = len(df)
        df = df[~df["sku"].isin(existing)]
        skipped = before - len(df)
        if skipped:
            print(f"Skipping {skipped} SKUs with existing insights (use --force to regenerate)")

    total = len(df)
    if total == 0:
        print("Nothing to generate.")
        conn.close()
        return

    print(f"Generating insights for {total} SKUs using {args.model}...\n")
    start_time = time.time()
    success = 0
    errors = 0
    BAR_WIDTH = 30

    for i, (_, row) in enumerate(df.iterrows(), 1):
        sku = row["sku"]
        name = row["display_name"]
        # Truncate long product names
        label = name if len(name) <= 40 else name[:37] + "..."

        # Show "generating..." on same line while Ollama works
        pct = i / total
        filled = int(BAR_WIDTH * pct)
        bar = "█" * filled + "░" * (BAR_WIDTH - filled)
        sys.stdout.write(f"\r  {bar} {i}/{total} ({pct:.0%})  ⏳ {label}")
        sys.stdout.flush()

        try:
            detail = get_sku_detail_data(conn, sku)
            prompt = build_prompt(row, detail)
            insight = generate_insight(prompt, args.model)

            conn.execute(
                """
                INSERT INTO sku_insights (sku, insight, model, generated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(sku) DO UPDATE SET
                    insight = excluded.insight,
                    model = excluded.model,
                    generated_at = excluded.generated_at
                """,
                (sku, insight, args.model),
            )
            conn.commit()
            success += 1

            elapsed = time.time() - start_time
            avg = elapsed / i
            eta = avg * (total - i)
            # Clear line, print completed result
            sys.stdout.write(f"\r  {bar} {i}/{total} ({pct:.0%})  ✓ {label}  ({avg:.1f}s/sku · ETA {eta / 60:.0f}m)\n")
            sys.stdout.flush()

        except requests.ConnectionError:
            sys.stdout.write("\n")
            print(f"\nError: Cannot connect to Ollama at {OLLAMA_URL}")
            print("Make sure Ollama is running: ollama serve")
            conn.close()
            sys.exit(1)
        except Exception as e:
            errors += 1
            sys.stdout.write(f"\r  {bar} {i}/{total} ({pct:.0%})  ✗ {label}  — {e}\n")
            sys.stdout.flush()

    conn.close()
    elapsed = time.time() - start_time
    print(f"\nDone! {success} generated, {errors} errors in {elapsed / 60:.1f} minutes")


if __name__ == "__main__":
    main()
