#!/usr/bin/env python3
"""
Comprehensive Data Quality Audit for FlooringInc Inventory Forecast
Analyzes: inventory, sales, lead_times tables
Outputs: detailed report of anomalies, questionable data, and cleanup recommendations
"""
import sqlite3
from collections import Counter

DB_PATH = "/tmp/forecast.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def subsection(title):
    print(f"\n--- {title} ---\n")

def run_audit():
    conn = get_conn()

    # ============================================================
    # SECTION 1: OVERVIEW
    # ============================================================
    section("1. DATASET OVERVIEW")

    inv_count = conn.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
    sales_count = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
    lt_count = conn.execute("SELECT COUNT(*) FROM lead_times").fetchone()[0]

    print(f"Inventory SKUs:     {inv_count:,}")
    print(f"Sales transactions: {sales_count:,}")
    print(f"Lead time entries:  {lt_count:,}")

    date_range = conn.execute("SELECT MIN(order_date), MAX(order_date) FROM sales").fetchone()
    print(f"Sales date range:   {date_range[0]} to {date_range[1]}")

    channels = conn.execute("SELECT DISTINCT channel FROM sales ORDER BY channel").fetchall()
    print(f"Sales channels:     {', '.join(r[0] or 'NULL' for r in channels)}")

    # ============================================================
    # SECTION 2: INVENTORY ANOMALIES
    # ============================================================
    section("2. INVENTORY ANOMALIES")

    # 2a. Negative on_hand (backorders)
    subsection("2a. Negative On-Hand (Backorders)")
    rows = conn.execute("""
        SELECT sku, display_name, on_hand, manufacturer
        FROM inventory
        WHERE on_hand < 0
        ORDER BY on_hand ASC
        LIMIT 30
    """).fetchall()
    print(f"Total SKUs with negative on_hand: {conn.execute('SELECT COUNT(*) FROM inventory WHERE on_hand < 0').fetchone()[0]:,}")
    if rows:
        print(f"{'SKU':<30} {'On Hand':>10} {'Manufacturer':<25} Display Name")
        for r in rows:
            print(f"{r['sku']:<30} {r['on_hand']:>10,} {(r['manufacturer'] or '-'):<25} {(r['display_name'] or '')[:50]}")

    # 2b. Extremely high on_hand
    subsection("2b. Extremely High On-Hand (top 20)")
    rows = conn.execute("""
        SELECT sku, display_name, on_hand, manufacturer
        FROM inventory
        WHERE on_hand > 0
        ORDER BY on_hand DESC
        LIMIT 20
    """).fetchall()
    print(f"{'SKU':<30} {'On Hand':>10} {'Manufacturer':<25} Display Name")
    for r in rows:
        print(f"{r['sku']:<30} {r['on_hand']:>10,} {(r['manufacturer'] or '-'):<25} {(r['display_name'] or '')[:50]}")

    # 2c. Zero on_hand
    zero_inv = conn.execute("SELECT COUNT(*) FROM inventory WHERE on_hand = 0").fetchone()[0]
    print(f"\nTotal SKUs with exactly 0 on_hand: {zero_inv:,}")

    # 2d. Missing display_name
    subsection("2d. Missing/Empty Display Names")
    rows = conn.execute("""
        SELECT sku, display_name, on_hand FROM inventory
        WHERE display_name IS NULL OR display_name = '' OR display_name = sku
        LIMIT 20
    """).fetchall()
    missing_dn = conn.execute("SELECT COUNT(*) FROM inventory WHERE display_name IS NULL OR display_name = '' OR display_name = sku").fetchone()[0]
    print(f"Total: {missing_dn:,}")
    for r in rows:
        print(f"  {r['sku']} -> display_name: '{r['display_name']}' (on_hand: {r['on_hand']})")

    # 2e. Missing manufacturer
    subsection("2e. Missing Manufacturer")
    no_mfr = conn.execute("SELECT COUNT(*) FROM inventory WHERE manufacturer IS NULL OR manufacturer = ''").fetchone()[0]
    has_mfr = conn.execute("SELECT COUNT(*) FROM inventory WHERE manufacturer IS NOT NULL AND manufacturer != ''").fetchone()[0]
    print(f"With manufacturer:    {has_mfr:,}")
    print(f"Without manufacturer: {no_mfr:,}")

    # 2f. Sample items
    subsection("2f. Sample Items (is_sample=1)")
    sample_count = conn.execute("SELECT COUNT(*) FROM inventory WHERE is_sample = 1").fetchone()[0]
    sample_with_stock = conn.execute("SELECT COUNT(*) FROM inventory WHERE is_sample = 1 AND on_hand > 0").fetchone()[0]
    print(f"Total sample SKUs:      {sample_count:,}")
    print(f"Samples with stock > 0: {sample_with_stock:,}")

    # 2g. Duplicate/similar SKUs
    subsection("2g. SKUs in Inventory NOT in Sales (never sold)")
    never_sold = conn.execute("""
        SELECT COUNT(*) FROM inventory i
        WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.sku = i.sku)
    """).fetchone()[0]
    never_sold_with_stock = conn.execute("""
        SELECT COUNT(*) FROM inventory i
        WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.sku = i.sku)
        AND i.on_hand > 0 AND i.is_sample = 0
    """).fetchone()[0]
    print(f"Inventory SKUs with no sales history: {never_sold:,}")
    print(f"  ...of which have stock > 0 and NOT samples: {never_sold_with_stock:,}")

    # ============================================================
    # SECTION 3: SALES DATA ANOMALIES
    # ============================================================
    section("3. SALES DATA ANOMALIES")

    # 3a. Zero revenue transactions
    subsection("3a. Zero Revenue Transactions ($0)")
    zero_rev = conn.execute("SELECT COUNT(*) FROM sales WHERE item_revenue = 0 OR item_revenue IS NULL").fetchone()[0]
    total_sales = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
    print(f"Zero/null revenue transactions: {zero_rev:,} ({zero_rev/total_sales*100:.1f}% of all)")

    zero_by_channel = conn.execute("""
        SELECT channel, COUNT(*) as cnt, SUM(quantity) as total_qty
        FROM sales
        WHERE item_revenue = 0 OR item_revenue IS NULL
        GROUP BY channel
        ORDER BY cnt DESC
    """).fetchall()
    print(f"\n  {'Channel':<35} {'Count':>10} {'Total Qty':>12}")
    for r in zero_by_channel:
        print(f"  {(r['channel'] or 'NULL'):<35} {r['cnt']:>10,} {r['total_qty']:>12,}")

    # Top SKUs with zero revenue
    print(f"\n  Top 15 SKUs with most $0-revenue lines:")
    zero_rev_skus = conn.execute("""
        SELECT s.sku, COUNT(*) as cnt, SUM(s.quantity) as total_qty,
               i.display_name, i.on_hand
        FROM sales s
        LEFT JOIN inventory i ON i.sku = s.sku
        WHERE s.item_revenue = 0 OR s.item_revenue IS NULL
        GROUP BY s.sku
        ORDER BY cnt DESC
        LIMIT 15
    """).fetchall()
    print(f"  {'SKU':<30} {'Lines':>8} {'Qty':>10} {'On Hand':>10} Display Name")
    for r in zero_rev_skus:
        print(f"  {r['sku']:<30} {r['cnt']:>8,} {r['total_qty']:>10,} {(r['on_hand'] or 0):>10,} {(r['display_name'] or '')[:40]}")

    # 3b. Negative revenue
    subsection("3b. Negative Revenue Transactions")
    neg_rev = conn.execute("SELECT COUNT(*) FROM sales WHERE item_revenue < 0").fetchone()[0]
    print(f"Negative revenue transactions: {neg_rev:,}")
    if neg_rev > 0:
        neg_by_channel = conn.execute("""
            SELECT channel, COUNT(*) as cnt, SUM(item_revenue) as total_rev
            FROM sales WHERE item_revenue < 0
            GROUP BY channel ORDER BY cnt DESC
        """).fetchall()
        for r in neg_by_channel:
            print(f"  {(r['channel'] or 'NULL'):<35} {r['cnt']:>8,} lines  ${r['total_rev']:>12,.2f}")

    # 3c. Zero quantity
    subsection("3c. Zero Quantity Transactions")
    zero_qty = conn.execute("SELECT COUNT(*) FROM sales WHERE quantity = 0").fetchone()[0]
    print(f"Zero quantity transactions: {zero_qty:,}")

    # 3d. Very high quantity single transactions
    subsection("3d. Unusually High Quantity (single transaction)")
    rows = conn.execute("""
        SELECT order_date, sku, quantity, channel, item_revenue, product_name
        FROM sales
        WHERE quantity > 500
        ORDER BY quantity DESC
        LIMIT 25
    """).fetchall()
    print(f"Transactions with qty > 500: {conn.execute('SELECT COUNT(*) FROM sales WHERE quantity > 500').fetchone()[0]:,}")
    if rows:
        print(f"  {'Date':<12} {'SKU':<25} {'Qty':>8} {'Revenue':>12} {'Channel':<20} Product")
        for r in rows:
            print(f"  {r['order_date']:<12} {r['sku']:<25} {r['quantity']:>8,} ${r['item_revenue']:>11,.0f} {(r['channel'] or '-'):<20} {(r['product_name'] or '')[:30]}")

    # 3e. Sales for SKUs not in inventory
    subsection("3e. Sales for SKUs NOT in Inventory")
    orphan_sales = conn.execute("""
        SELECT COUNT(DISTINCT s.sku) as sku_count, COUNT(*) as line_count, SUM(s.quantity) as total_qty, SUM(s.item_revenue) as total_rev
        FROM sales s
        WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.sku = s.sku)
    """).fetchone()
    print(f"Unique SKUs in sales but not inventory: {orphan_sales['sku_count']:,}")
    print(f"Total transaction lines:                {orphan_sales['line_count']:,}")
    print(f"Total quantity:                         {orphan_sales['total_qty']:,}")
    print(f"Total revenue:                          ${orphan_sales['total_rev']:,.0f}")

    top_orphans = conn.execute("""
        SELECT s.sku, COUNT(*) as lines, SUM(s.quantity) as qty, SUM(s.item_revenue) as rev,
               MAX(s.product_name) as name, MAX(s.channel) as channel
        FROM sales s
        WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.sku = s.sku)
        GROUP BY s.sku
        ORDER BY rev DESC
        LIMIT 15
    """).fetchall()
    if top_orphans:
        print(f"\n  Top 15 by revenue:")
        print(f"  {'SKU':<30} {'Lines':>6} {'Qty':>8} {'Revenue':>12} {'Channel':<15} Name")
        for r in top_orphans:
            print(f"  {r['sku']:<30} {r['lines']:>6,} {r['qty']:>8,} ${r['rev']:>11,.0f} {(r['channel'] or '-'):<15} {(r['name'] or '')[:30]}")

    # 3f. Channel analysis
    subsection("3f. Channel Distribution")
    channels = conn.execute("""
        SELECT channel, COUNT(*) as lines, SUM(quantity) as qty, SUM(item_revenue) as rev,
               COUNT(DISTINCT sku) as skus
        FROM sales
        GROUP BY channel
        ORDER BY rev DESC
    """).fetchall()
    print(f"  {'Channel':<35} {'Lines':>10} {'Quantity':>12} {'Revenue':>15} {'SKUs':>8}")
    for r in channels:
        print(f"  {(r['channel'] or 'NULL'):<35} {r['lines']:>10,} {r['qty']:>12,} ${r['rev']:>14,.0f} {r['skus']:>8,}")

    # 3g. "Other" channel deep dive
    subsection("3g. 'Other' Channel Breakdown")
    other_count = conn.execute("SELECT COUNT(*) FROM sales WHERE channel = 'Other'").fetchone()[0]
    print(f"Total 'Other' channel transactions: {other_count:,}")
    # Check what original channels map to "Other"
    # We can check for patterns in product names or dates
    other_samples = conn.execute("""
        SELECT order_date, sku, quantity, item_revenue, product_name
        FROM sales WHERE channel = 'Other'
        ORDER BY item_revenue DESC
        LIMIT 15
    """).fetchall()
    if other_samples:
        print(f"\n  Top 'Other' channel by revenue:")
        print(f"  {'Date':<12} {'SKU':<25} {'Qty':>6} {'Revenue':>12} Product")
        for r in other_samples:
            print(f"  {r['order_date']:<12} {r['sku']:<25} {r['quantity']:>6,} ${r['item_revenue']:>11,.0f} {(r['product_name'] or '')[:40]}")

    # 3h. Duplicate transactions
    subsection("3h. Potential Duplicate Transactions")
    dupes = conn.execute("""
        SELECT order_date, sku, quantity, channel, item_revenue, COUNT(*) as cnt
        FROM sales
        GROUP BY order_date, sku, quantity, channel, item_revenue
        HAVING cnt > 3
        ORDER BY cnt DESC
        LIMIT 20
    """).fetchall()
    total_dupe_groups = conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT 1 FROM sales
            GROUP BY order_date, sku, quantity, channel, item_revenue
            HAVING COUNT(*) > 3
        )
    """).fetchone()[0]
    print(f"Groups with >3 identical lines (same date+sku+qty+channel+revenue): {total_dupe_groups:,}")
    if dupes:
        print(f"\n  {'Date':<12} {'SKU':<25} {'Qty':>6} {'Revenue':>10} {'Channel':<20} {'Dupes':>6}")
        for r in dupes:
            print(f"  {r['order_date']:<12} {r['sku']:<25} {r['quantity']:>6} ${r['item_revenue']:>9,.0f} {(r['channel'] or '-'):<20} {r['cnt']:>6}")

    # 3i. Date anomalies
    subsection("3i. Date Distribution (monthly)")
    months = conn.execute("""
        SELECT substr(order_date, 1, 7) as month, COUNT(*) as lines,
               SUM(quantity) as qty, SUM(item_revenue) as rev
        FROM sales
        GROUP BY month
        ORDER BY month
    """).fetchall()
    print(f"  {'Month':<10} {'Lines':>10} {'Quantity':>12} {'Revenue':>15}")
    for r in months:
        print(f"  {r['month']:<10} {r['lines']:>10,} {r['qty']:>12,} ${r['rev']:>14,.0f}")

    # 3j. Future dates
    subsection("3j. Future/Invalid Dates")
    future = conn.execute("SELECT COUNT(*) FROM sales WHERE order_date > date('now')").fetchone()[0]
    invalid = conn.execute("SELECT COUNT(*) FROM sales WHERE order_date IS NULL OR length(order_date) != 10").fetchone()[0]
    print(f"Sales with future dates:  {future:,}")
    print(f"Sales with invalid dates: {invalid:,}")
    if future > 0:
        rows = conn.execute("SELECT DISTINCT order_date FROM sales WHERE order_date > date('now') ORDER BY order_date LIMIT 10").fetchall()
        print(f"  Future dates found: {', '.join(r[0] for r in rows)}")

    # ============================================================
    # SECTION 4: CROSS-TABLE CONSISTENCY
    # ============================================================
    section("4. CROSS-TABLE CONSISTENCY")

    # 4a. SKU format analysis
    subsection("4a. SKU Format Patterns")
    # Check different SKU patterns
    patterns = {
        "Numeric only": conn.execute("SELECT COUNT(*) FROM inventory WHERE sku GLOB '[0-9]*'").fetchone()[0],
        "Starts with S-": conn.execute("SELECT COUNT(*) FROM inventory WHERE sku LIKE 'S-%'").fetchone()[0],
        "Contains underscore": conn.execute("SELECT COUNT(*) FROM inventory WHERE sku LIKE '%_%'").fetchone()[0],
        "Contains dash": conn.execute("SELECT COUNT(*) FROM inventory WHERE sku LIKE '%-%'").fetchone()[0],
        "Contains space": conn.execute("SELECT COUNT(*) FROM inventory WHERE sku LIKE '% %'").fetchone()[0],
        "Very long (>40 chars)": conn.execute("SELECT COUNT(*) FROM inventory WHERE length(sku) > 40").fetchone()[0],
        "Very short (<3 chars)": conn.execute("SELECT COUNT(*) FROM inventory WHERE length(sku) < 3").fetchone()[0],
    }
    for label, count in patterns.items():
        print(f"  {label:<30} {count:>8,}")

    # Short SKUs
    short_skus = conn.execute("SELECT sku, display_name, on_hand FROM inventory WHERE length(sku) < 3 LIMIT 10").fetchall()
    if short_skus:
        print(f"\n  Very short SKUs:")
        for r in short_skus:
            print(f"    '{r['sku']}' -> {r['display_name']} (on_hand: {r['on_hand']})")

    # 4b. Revenue per unit analysis (price outliers)
    subsection("4b. Revenue per Unit Outliers")
    print("  Extremely high price per unit (>$5000/unit):")
    high_price = conn.execute("""
        SELECT sku, order_date, quantity, item_revenue,
               ROUND(item_revenue / NULLIF(quantity, 0), 2) as price_per_unit,
               channel, product_name
        FROM sales
        WHERE quantity > 0 AND item_revenue > 0
          AND (item_revenue / quantity) > 5000
        ORDER BY (item_revenue / quantity) DESC
        LIMIT 15
    """).fetchall()
    if high_price:
        print(f"  {'Date':<12} {'SKU':<25} {'Qty':>5} {'Revenue':>12} {'$/Unit':>10} {'Channel':<15}")
        for r in high_price:
            print(f"  {r['order_date']:<12} {r['sku']:<25} {r['quantity']:>5} ${r['item_revenue']:>11,.0f} ${r['price_per_unit']:>9,.0f} {(r['channel'] or '-'):<15}")

    print("\n  Extremely low price per unit (<$0.50/unit, revenue > 0):")
    low_price = conn.execute("""
        SELECT sku, order_date, quantity, item_revenue,
               ROUND(item_revenue / NULLIF(quantity, 0), 2) as price_per_unit,
               channel, product_name
        FROM sales
        WHERE quantity > 0 AND item_revenue > 0
          AND (item_revenue / quantity) < 0.50
        ORDER BY quantity DESC
        LIMIT 15
    """).fetchall()
    if low_price:
        print(f"  {'Date':<12} {'SKU':<25} {'Qty':>5} {'Revenue':>12} {'$/Unit':>10} {'Channel':<15}")
        for r in low_price:
            print(f"  {r['order_date']:<12} {r['sku']:<25} {r['quantity']:>5} ${r['item_revenue']:>11,.2f} ${r['price_per_unit']:>9,.2f} {(r['channel'] or '-'):<15}")

    # 4c. SKUs with sales but wildly inconsistent pricing
    subsection("4c. SKUs with Highly Inconsistent Pricing")
    inconsistent = conn.execute("""
        SELECT sku,
               COUNT(*) as lines,
               ROUND(MIN(item_revenue / NULLIF(quantity, 0)), 2) as min_price,
               ROUND(AVG(item_revenue / NULLIF(quantity, 0)), 2) as avg_price,
               ROUND(MAX(item_revenue / NULLIF(quantity, 0)), 2) as max_price,
               SUM(quantity) as total_qty
        FROM sales
        WHERE quantity > 0 AND item_revenue > 0
        GROUP BY sku
        HAVING lines > 5
          AND max_price > avg_price * 5
          AND avg_price > 1
        ORDER BY (max_price - min_price) DESC
        LIMIT 15
    """).fetchall()
    if inconsistent:
        print(f"  {'SKU':<30} {'Lines':>6} {'Min $/u':>10} {'Avg $/u':>10} {'Max $/u':>10} {'TotalQty':>10}")
        for r in inconsistent:
            print(f"  {r['sku']:<30} {r['lines']:>6,} ${r['min_price']:>9,.2f} ${r['avg_price']:>9,.2f} ${r['max_price']:>9,.2f} {r['total_qty']:>10,}")

    # ============================================================
    # SECTION 5: INVENTORY vs SALES VELOCITY MISMATCH
    # ============================================================
    section("5. VELOCITY & STOCK CONCERNS")

    # 5a. High stock, zero sales
    subsection("5a. High Stock but Zero Sales (potential dead stock)")
    dead_stock = conn.execute("""
        SELECT i.sku, i.display_name, i.on_hand, i.manufacturer
        FROM inventory i
        WHERE i.on_hand > 100
          AND i.is_sample = 0
          AND NOT EXISTS (
              SELECT 1 FROM sales s
              WHERE s.sku = i.sku
              AND s.order_date >= date('now', '-180 days')
          )
        ORDER BY i.on_hand DESC
        LIMIT 20
    """).fetchall()
    print(f"SKUs with on_hand > 100 and NO sales in last 180 days:")
    if dead_stock:
        print(f"  {'SKU':<30} {'On Hand':>10} {'Manufacturer':<25} Display Name")
        for r in dead_stock:
            print(f"  {r['sku']:<30} {r['on_hand']:>10,} {(r['manufacturer'] or '-'):<25} {(r['display_name'] or '')[:40]}")

    # 5b. Massive sales, zero inventory
    subsection("5b. High Sales Volume but Zero Inventory")
    high_sales_no_inv = conn.execute("""
        SELECT s.sku, SUM(s.quantity) as total_qty, SUM(s.item_revenue) as total_rev,
               COUNT(*) as lines, i.on_hand, i.display_name
        FROM sales s
        LEFT JOIN inventory i ON i.sku = s.sku
        WHERE s.order_date >= date('now', '-90 days')
        GROUP BY s.sku
        HAVING total_qty > 50 AND (i.on_hand IS NULL OR i.on_hand = 0)
        ORDER BY total_rev DESC
        LIMIT 15
    """).fetchall()
    if high_sales_no_inv:
        print(f"  {'SKU':<30} {'90d Qty':>8} {'90d Rev':>12} {'On Hand':>10} Display Name")
        for r in high_sales_no_inv:
            print(f"  {r['sku']:<30} {r['total_qty']:>8,} ${r['total_rev']:>11,.0f} {(r['on_hand'] or 0):>10} {(r['display_name'] or 'NOT IN INVENTORY')[:35]}")

    # ============================================================
    # SECTION 6: MANUFACTURER DATA QUALITY
    # ============================================================
    section("6. MANUFACTURER DATA QUALITY")

    subsection("6a. Manufacturer Distribution (top 30)")
    mfrs = conn.execute("""
        SELECT
            CASE WHEN manufacturer IS NULL OR manufacturer = '' THEN '(empty)' ELSE manufacturer END as mfr,
            COUNT(*) as sku_count,
            SUM(on_hand) as total_stock
        FROM inventory
        GROUP BY mfr
        ORDER BY sku_count DESC
        LIMIT 30
    """).fetchall()
    print(f"  {'Manufacturer':<40} {'SKUs':>8} {'Total Stock':>12}")
    for r in mfrs:
        print(f"  {r['mfr']:<40} {r['sku_count']:>8,} {r['total_stock']:>12,}")

    # Check for similar manufacturer names (potential duplicates)
    subsection("6b. Potential Duplicate Manufacturer Names")
    all_mfrs = conn.execute("""
        SELECT DISTINCT manufacturer FROM inventory
        WHERE manufacturer IS NOT NULL AND manufacturer != ''
        ORDER BY manufacturer
    """).fetchall()
    mfr_names = [r['manufacturer'] for r in all_mfrs]

    # Simple check: lowercase grouping
    lower_groups = {}
    for name in mfr_names:
        key = name.lower().strip()
        if key not in lower_groups:
            lower_groups[key] = []
        lower_groups[key].append(name)

    dupes = {k: v for k, v in lower_groups.items() if len(v) > 1}
    if dupes:
        for key, names in dupes.items():
            print(f"  Possible duplicates: {names}")
    else:
        print("  No case-insensitive duplicates found.")

    # ============================================================
    # SECTION 7: SUMMARY OF ISSUES
    # ============================================================
    section("7. SUMMARY — QUESTIONS FOR THE TEAM")

    issues = []

    if zero_rev > 0:
        issues.append(f"1. ZERO-REVENUE TRANSACTIONS: {zero_rev:,} sales lines ({zero_rev/total_sales*100:.1f}%) have $0 revenue. Are these internal transfers, warehouse moves, or data issues? Should they be excluded from velocity/forecast calculations?")

    if neg_rev > 0:
        issues.append(f"2. NEGATIVE REVENUE: {neg_rev:,} transactions have negative revenue. Are these returns/refunds? How should returns affect the forecast?")

    if orphan_sales['sku_count'] > 0:
        issues.append(f"3. ORPHAN SALES: {orphan_sales['sku_count']:,} SKUs appear in sales but NOT in inventory. Are these discontinued products? Were they removed from NetSuite inventory?")

    if never_sold_with_stock > 0:
        issues.append(f"4. NEVER-SOLD INVENTORY: {never_sold_with_stock:,} non-sample SKUs have stock on hand but zero sales history. Are these new products, or data mapping issues?")

    if other_count > 0:
        issues.append(f"5. 'OTHER' CHANNEL: {other_count:,} sales transactions mapped to 'Other' channel. What are the actual source channels? Should we add more channel mappings?")

    if total_dupe_groups > 0:
        issues.append(f"6. POTENTIAL DUPLICATES: {total_dupe_groups:,} groups of identical transactions (same date+sku+qty+channel+revenue appearing 4+ times). Are these legitimate separate orders or duplicated data?")

    dead_count = len(dead_stock) if dead_stock else 0
    if dead_count > 0:
        issues.append(f"7. DEAD STOCK: {dead_count}+ SKUs with significant stock (>100 units) but no sales in 180 days. Should these be flagged differently in the forecast?")

    if zero_qty > 0:
        issues.append(f"8. ZERO-QUANTITY LINES: {zero_qty:,} sales lines have quantity=0. What do these represent?")

    for issue in issues:
        print(f"\n{issue}")

    print(f"\n{'='*80}")
    print(f"  END OF AUDIT REPORT")
    print(f"{'='*80}")

    conn.close()


if __name__ == "__main__":
    run_audit()
