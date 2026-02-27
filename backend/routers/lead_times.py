from fastapi import APIRouter, HTTPException, Query
from database import get_connection, sync_to_turso
from models import LeadTimeUpdate, LeadTimeResponse

router = APIRouter(prefix="/api/lead-times", tags=["lead_times"])


@router.get("/", response_model=list[LeadTimeResponse])
def list_lead_times(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: str = Query(""),
):
    conn = get_connection()
    query = "SELECT sku, product_category, lead_time_days, source, updated_at FROM lead_times"
    params = []

    if search:
        query += " WHERE sku LIKE ? OR product_category LIKE ?"
        params = [f"%{search}%", f"%{search}%"]

    query += " ORDER BY sku LIMIT ? OFFSET ?"
    params.extend([page_size, (page - 1) * page_size])

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [
        LeadTimeResponse(
            sku=r["sku"],
            product_category=r["product_category"],
            lead_time_days=r["lead_time_days"],
            source=r["source"],
            updated_at=r["updated_at"],
        )
        for r in rows
    ]


@router.put("/{sku}", response_model=LeadTimeResponse)
def update_lead_time(sku: str, body: LeadTimeUpdate):
    conn = get_connection()

    # Check if SKU exists in inventory
    inv = conn.execute("SELECT sku FROM inventory WHERE sku = ?", (sku,)).fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail=f"SKU {sku} not found in inventory")

    # Get product category from sales if available
    cat_row = conn.execute(
        "SELECT product_category FROM sales WHERE sku = ? AND product_category IS NOT NULL LIMIT 1",
        (sku,),
    ).fetchone()
    category = cat_row["product_category"] if cat_row else None

    conn.execute(
        """INSERT INTO lead_times (sku, product_category, lead_time_days, source, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(sku) DO UPDATE SET
             lead_time_days = excluded.lead_time_days,
             source = excluded.source,
             updated_at = datetime('now')""",
        (sku, category, body.lead_time_days, body.source),
    )
    conn.commit()
    sync_to_turso()

    row = conn.execute("SELECT * FROM lead_times WHERE sku = ?", (sku,)).fetchone()
    conn.close()

    return LeadTimeResponse(
        sku=row["sku"],
        product_category=row["product_category"],
        lead_time_days=row["lead_time_days"],
        source=row["source"],
        updated_at=row["updated_at"],
    )
