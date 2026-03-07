"""
Tool definitions and executors for the chat agent.
8 tools the LLM can call to query inventory, sales, POs, and forecast data.
"""

import sqlite3
import json
import re
from database import get_connection
from services.forecast_engine import build_forecast


# --- Tool Definitions (Ollama tool format) ---

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "query_inventory",
            "description": "Search inventory SKUs by name, manufacturer, or urgency level. Returns SKU, name, available qty, velocity, urgency, days remaining, and lead time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {
                        "type": "string",
                        "description": "Search term to match against SKU code or product name (partial match)",
                    },
                    "manufacturer": {
                        "type": "string",
                        "description": "Filter by manufacturer name (exact match)",
                    },
                    "urgency": {
                        "type": "string",
                        "enum": ["BACKORDER", "RED", "YELLOW", "GREEN"],
                        "description": "Filter by urgency level",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max rows to return (default 20, max 50)",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sku_forecast",
            "description": "Get full forecast details for a specific SKU including on hand, available qty, velocity, seasonality, days remaining, urgency, lead time, and incoming PO quantity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {
                        "type": "string",
                        "description": "The exact SKU code",
                    },
                },
                "required": ["sku"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sku_detail",
            "description": "Get deep detail for a SKU: monthly sales history, channel breakdown, purchase orders, margins, and recent orders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {
                        "type": "string",
                        "description": "The exact SKU code",
                    },
                },
                "required": ["sku"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_sales",
            "description": "Aggregate sales data. Can group by date (month/week), channel, or SKU. Useful for revenue analysis, top sellers, channel performance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_by": {
                        "type": "string",
                        "enum": ["month", "week", "channel", "sku"],
                        "description": "How to group the results",
                    },
                    "sku": {
                        "type": "string",
                        "description": "Filter to a specific SKU",
                    },
                    "channel": {
                        "type": "string",
                        "description": "Filter to a specific channel (FI, Amazon, Home Depot, Wayfair, Walmart, eBay)",
                    },
                    "date_from": {
                        "type": "string",
                        "description": "Start date filter (YYYY-MM-DD)",
                    },
                    "date_to": {
                        "type": "string",
                        "description": "End date filter (YYYY-MM-DD)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max rows to return (default 20, max 50)",
                    },
                },
                "required": ["group_by"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_purchase_orders",
            "description": "Search purchase orders by vendor, SKU, status, or date range. Returns PO number, vendor, SKU, quantities, expected dates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor": {
                        "type": "string",
                        "description": "Filter by vendor name (partial match)",
                    },
                    "sku": {
                        "type": "string",
                        "description": "Filter by SKU code (partial match)",
                    },
                    "status": {
                        "type": "string",
                        "description": "Filter by PO status",
                    },
                    "date_from": {
                        "type": "string",
                        "description": "Expected date from (YYYY-MM-DD)",
                    },
                    "date_to": {
                        "type": "string",
                        "description": "Expected date to (YYYY-MM-DD)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max rows to return (default 20, max 50)",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_summary",
            "description": "Get overall inventory health summary: counts by urgency level (BACKORDER, RED, YELLOW, GREEN), total SKUs, and total value at risk.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_skus",
            "description": "Fuzzy text search for SKU codes and product names. Use this when you need to find SKUs matching a keyword or partial name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search text to match against SKU code and product name",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results (default 20, max 50)",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_sql_query",
            "description": "Run a read-only SQL SELECT query against the database. Tables: inventory (sku, display_name, on_hand, manufacturer, item_cost, qty_on_order, qty_committed, is_drop_ship, is_warehoused, source_type, is_sample), sales (id, order_date, sku, quantity, channel, product_category, item_revenue, product_cost, product_name, raw_channel), lead_times (sku, product_category, lead_time_days, source, updated_at), purchase_orders (id, po_number, po_date, status, vendor, sku, ordered_qty, received_qty, remaining_qty, expected_date, rate, amount). Max 100 rows returned.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "The SELECT SQL query to execute",
                    },
                },
                "required": ["sql"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save an important fact or preference to long-term memory so you can recall it in future conversations. Use this for user preferences, important business context, or recurring questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "Short label for the memory (e.g. 'user_preference', 'important_sku')",
                    },
                    "content": {
                        "type": "string",
                        "description": "The fact or information to remember",
                    },
                },
                "required": ["key", "content"],
            },
        },
    },
]


# --- Tool Executors ---

def _clamp_limit(limit, default=20, maximum=50):
    if limit is None:
        return default
    return min(max(1, int(limit)), maximum)


def execute_query_inventory(search=None, manufacturer=None, urgency=None, limit=None):
    limit = _clamp_limit(limit)
    df = build_forecast(velocity_window=90, active_only=True)

    if search:
        mask = df["sku"].str.contains(search, case=False, na=False) | df["display_name"].str.contains(search, case=False, na=False)
        df = df[mask]
    if manufacturer:
        df = df[df["manufacturer"].str.lower() == manufacturer.lower()]
    if urgency:
        df = df[df["urgency"] == urgency.upper()]

    df = df.head(limit)
    cols = ["sku", "display_name", "available_qty", "on_hand", "qty_committed", "velocity", "adjusted_velocity",
            "seasonality_factor", "days_remaining", "lead_time_days", "urgency", "manufacturer", "incoming_qty", "total_sold_90d", "total_revenue_90d"]
    result = df[[c for c in cols if c in df.columns]].to_dict(orient="records")
    # Clean up NaN/None
    for row in result:
        for k, v in row.items():
            if isinstance(v, float) and (v != v):  # NaN check
                row[k] = None
    return {"count": len(result), "items": result}


def execute_get_sku_forecast(sku):
    df = build_forecast(velocity_window=90, active_only=False)
    match = df[df["sku"] == sku]
    if match.empty:
        return {"error": f"SKU '{sku}' not found"}
    row = match.iloc[0].to_dict()
    # Clean NaN
    for k, v in row.items():
        if isinstance(v, float) and (v != v):
            row[k] = None
    return row


def execute_get_sku_detail(sku):
    conn = get_connection()

    # Basic info
    inv = conn.execute("SELECT * FROM inventory WHERE sku = ?", (sku,)).fetchone()
    if not inv:
        conn.close()
        return {"error": f"SKU '{sku}' not found"}

    # Monthly sales
    monthly = conn.execute("""
        SELECT strftime('%Y-%m', order_date) as month, SUM(quantity) as quantity, SUM(item_revenue) as revenue
        FROM sales WHERE sku = ? GROUP BY month ORDER BY month DESC LIMIT 12
    """, (sku,)).fetchall()

    # Channel breakdown
    channels = conn.execute("""
        SELECT channel, SUM(quantity) as quantity, SUM(item_revenue) as revenue
        FROM sales WHERE sku = ? AND order_date >= date('now', '-90 days')
        GROUP BY channel ORDER BY revenue DESC
    """, (sku,)).fetchall()

    # Purchase orders
    pos = conn.execute("""
        SELECT po_number, vendor, ordered_qty, received_qty, remaining_qty, expected_date, status
        FROM purchase_orders WHERE sku = ? ORDER BY expected_date DESC LIMIT 10
    """, (sku,)).fetchall()

    # 90-day financials
    financials = conn.execute("""
        SELECT SUM(item_revenue) as revenue, SUM(product_cost) as cost
        FROM sales WHERE sku = ? AND order_date >= date('now', '-90 days')
    """, (sku,)).fetchone()

    conn.close()

    result = {
        "sku": inv["sku"],
        "display_name": inv["display_name"],
        "on_hand": inv["on_hand"],
        "qty_committed": inv["qty_committed"],
        "available_qty": inv["on_hand"] - inv["qty_committed"],
        "manufacturer": inv["manufacturer"],
        "item_cost": inv["item_cost"],
        "monthly_sales": [dict(r) for r in monthly],
        "channel_breakdown": [dict(r) for r in channels],
        "purchase_orders": [dict(r) for r in pos],
        "revenue_90d": financials["revenue"] or 0,
        "cost_90d": financials["cost"] or 0,
        "margin_90d": round((1 - (financials["cost"] or 0) / financials["revenue"]) * 100, 1) if financials["revenue"] else None,
    }
    return result


def execute_query_sales(group_by, sku=None, channel=None, date_from=None, date_to=None, limit=None):
    limit = _clamp_limit(limit)
    conn = get_connection()

    conditions = []
    params = []
    if sku:
        conditions.append("sku = ?")
        params.append(sku)
    if channel:
        conditions.append("channel = ?")
        params.append(channel)
    if date_from:
        conditions.append("order_date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("order_date <= ?")
        params.append(date_to)

    where = " AND ".join(conditions) if conditions else "1=1"

    if group_by == "month":
        sql = f"""SELECT strftime('%Y-%m', order_date) as period, SUM(quantity) as total_qty,
                  SUM(item_revenue) as total_revenue, COUNT(*) as order_count
                  FROM sales WHERE {where} GROUP BY period ORDER BY period DESC LIMIT ?"""
    elif group_by == "week":
        sql = f"""SELECT strftime('%Y-W%W', order_date) as period, SUM(quantity) as total_qty,
                  SUM(item_revenue) as total_revenue, COUNT(*) as order_count
                  FROM sales WHERE {where} GROUP BY period ORDER BY period DESC LIMIT ?"""
    elif group_by == "channel":
        sql = f"""SELECT channel, SUM(quantity) as total_qty, SUM(item_revenue) as total_revenue,
                  COUNT(*) as order_count FROM sales WHERE {where} GROUP BY channel ORDER BY total_revenue DESC LIMIT ?"""
    elif group_by == "sku":
        sql = f"""SELECT sku, SUM(quantity) as total_qty, SUM(item_revenue) as total_revenue,
                  COUNT(*) as order_count FROM sales WHERE {where} GROUP BY sku ORDER BY total_revenue DESC LIMIT ?"""
    else:
        conn.close()
        return {"error": f"Invalid group_by: {group_by}"}

    params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return {"count": len(rows), "results": [dict(r) for r in rows]}


def execute_query_purchase_orders(vendor=None, sku=None, status=None, date_from=None, date_to=None, limit=None):
    limit = _clamp_limit(limit)
    conn = get_connection()

    conditions = []
    params = []
    if vendor:
        conditions.append("vendor LIKE ?")
        params.append(f"%{vendor}%")
    if sku:
        conditions.append("sku LIKE ?")
        params.append(f"%{sku}%")
    if status:
        conditions.append("status = ?")
        params.append(status)
    if date_from:
        conditions.append("expected_date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("expected_date <= ?")
        params.append(date_to)

    where = " AND ".join(conditions) if conditions else "1=1"

    rows = conn.execute(f"""
        SELECT po_number, po_date, status, vendor, sku, ordered_qty, received_qty,
               remaining_qty, expected_date, rate, amount
        FROM purchase_orders WHERE {where} ORDER BY expected_date DESC LIMIT ?
    """, params + [limit]).fetchall()
    conn.close()
    return {"count": len(rows), "results": [dict(r) for r in rows]}


def execute_get_dashboard_summary():
    df = build_forecast(velocity_window=90, active_only=True)
    urgency_counts = df["urgency"].value_counts().to_dict()

    # Value at risk = revenue of RED + BACKORDER items
    at_risk = df[df["urgency"].isin(["RED", "BACKORDER"])]["total_revenue_90d"].sum()

    return {
        "total_skus": len(df),
        "backorder": urgency_counts.get("BACKORDER", 0),
        "red": urgency_counts.get("RED", 0),
        "yellow": urgency_counts.get("YELLOW", 0),
        "green": urgency_counts.get("GREEN", 0),
        "total_value_at_risk": round(at_risk, 2),
    }


def execute_search_skus(query, limit=None):
    limit = _clamp_limit(limit)
    conn = get_connection()
    rows = conn.execute("""
        SELECT sku, display_name, on_hand, manufacturer
        FROM inventory WHERE is_sample = 0
        AND (sku LIKE ? OR display_name LIKE ?)
        LIMIT ?
    """, (f"%{query}%", f"%{query}%", limit)).fetchall()
    conn.close()
    return {"count": len(rows), "results": [dict(r) for r in rows]}


# SQL safety patterns
_FORBIDDEN_PATTERNS = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|REPLACE|PRAGMA|VACUUM|REINDEX)\b',
    re.IGNORECASE
)


def execute_run_sql_query(sql):
    sql = sql.strip().rstrip(";")

    # Safety: only SELECT allowed
    if not sql.upper().lstrip().startswith("SELECT"):
        return {"error": "Only SELECT queries are allowed"}
    if _FORBIDDEN_PATTERNS.search(sql):
        return {"error": "Query contains forbidden keywords"}

    conn = get_connection()
    conn.execute("PRAGMA query_only = ON")
    try:
        cursor = conn.execute(sql)
        columns = [d[0] for d in cursor.description] if cursor.description else []
        rows = cursor.fetchmany(100)
        result = [dict(zip(columns, row)) for row in rows]
        return {"columns": columns, "count": len(result), "rows": result}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


# --- Dispatcher ---

TOOL_EXECUTORS = {
    "query_inventory": execute_query_inventory,
    "get_sku_forecast": execute_get_sku_forecast,
    "get_sku_detail": execute_get_sku_detail,
    "query_sales": execute_query_sales,
    "query_purchase_orders": execute_query_purchase_orders,
    "get_dashboard_summary": execute_get_dashboard_summary,
    "search_skus": execute_search_skus,
    "run_sql_query": execute_run_sql_query,
    # save_memory is handled in chat_agent.py directly
}


# Human-readable status messages for tool calls
TOOL_STATUS_MESSAGES = {
    "query_inventory": "Searching inventory...",
    "get_sku_forecast": "Looking up forecast...",
    "get_sku_detail": "Fetching SKU details...",
    "query_sales": "Analyzing sales data...",
    "query_purchase_orders": "Checking purchase orders...",
    "get_dashboard_summary": "Getting dashboard summary...",
    "search_skus": "Searching SKUs...",
    "run_sql_query": "Running database query...",
    "save_memory": "Saving to memory...",
}


def execute_tool(name: str, arguments: dict) -> str:
    """Execute a tool by name and return JSON string result."""
    executor = TOOL_EXECUTORS.get(name)
    if not executor:
        return json.dumps({"error": f"Unknown tool: {name}"})
    try:
        result = executor(**arguments)
        return json.dumps(result, default=str)
    except Exception as e:
        return json.dumps({"error": f"Tool execution failed: {str(e)}"})
