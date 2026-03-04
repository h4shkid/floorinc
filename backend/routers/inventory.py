from fastapi import APIRouter, HTTPException
from database import get_connection, sync_to_cloud
from models import DropShipUpdate

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.put("/{sku}/drop-ship")
def update_drop_ship(sku: str, body: DropShipUpdate):
    conn = get_connection()

    row = conn.execute("SELECT sku FROM inventory WHERE sku = ?", (sku,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"SKU {sku} not found in inventory")

    conn.execute(
        "UPDATE inventory SET is_drop_ship = ? WHERE sku = ?",
        (body.is_drop_ship, sku),
    )
    conn.commit()
    sync_to_cloud()
    conn.close()

    return {"sku": sku, "is_drop_ship": body.is_drop_ship}
