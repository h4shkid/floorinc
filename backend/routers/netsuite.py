from fastapi import APIRouter, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from services.netsuite_client import is_configured, execute_suiteql
from services.netsuite_sync import run_full_sync, run_sales_sync
from services.sync_status import sync_status
from database import get_connection

router = APIRouter(prefix="/api/netsuite", tags=["netsuite"])


@router.get("/status")
def get_status():
    status = sync_status.get()
    status["configured"] = is_configured()
    return status


@router.post("/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    if not is_configured():
        return JSONResponse(status_code=400, content={"detail": "NetSuite credentials not configured"})
    if sync_status.is_running:
        return JSONResponse(status_code=409, content={"detail": "Sync already in progress"})
    background_tasks.add_task(run_full_sync)
    sync_status.start()
    return {"message": "Sync started"}


@router.post("/sync/sales")
def trigger_sales_sync(background_tasks: BackgroundTasks):
    if not is_configured():
        return JSONResponse(status_code=400, content={"detail": "NetSuite credentials not configured"})
    if sync_status.is_running:
        return JSONResponse(status_code=409, content={"detail": "Sync already in progress"})
    background_tasks.add_task(run_sales_sync)
    sync_status.start()
    return {"message": "Sales sync started"}


@router.get("/debug/sales-check")
def debug_sales_check():
    """Debug endpoint: check what NetSuite returns for recent sales."""
    if not is_configured():
        return {"error": "NetSuite not configured"}

    # What's in the DB
    conn = get_connection()
    max_date = conn.execute("SELECT MAX(order_date) FROM sales").fetchone()[0]
    recent_count = conn.execute(
        "SELECT COUNT(*) FROM sales WHERE order_date >= '2026-02-20'"
    ).fetchone()[0]
    conn.close()

    # Test query against NetSuite — last 7 days, limit 5
    test_query = """
        SELECT
            TO_CHAR(t.tranDate, 'YYYY-MM-DD') AS order_date,
            item.itemId AS sku,
            tl.quantity AS quantity,
            t.status AS status,
            tl.netAmount AS net_amount,
            tl.rate AS rate
        FROM transactionLine tl
        JOIN transaction t ON t.id = tl.transaction
        JOIN item ON item.id = tl.item
        WHERE tl.mainLine = 'F'
          AND t.type = 'SalesOrd'
          AND tl.itemType IN ('InvtPart', 'Kit')
          AND t.tranDate >= TO_DATE('2026-02-25', 'YYYY-MM-DD')
          AND tl.quantity > 0
        ORDER BY t.tranDate DESC
    """
    try:
        result = execute_suiteql(test_query, limit=10)
        items = result.get("items", [])
        total = result.get("totalResults", 0)
    except Exception as e:
        items = []
        total = f"ERROR: {e}"

    return {
        "db_max_date": max_date,
        "db_recent_count_since_feb20": recent_count,
        "netsuite_total_results": total,
        "netsuite_sample": items,
    }
