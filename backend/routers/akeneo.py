from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from services.akeneo_client import is_configured
from services.akeneo_sync import (
    akeneo_sync_status,
    akeneo_preview_status,
    run_akeneo_sync,
    run_akeneo_preview,
    get_preview_results,
)

router = APIRouter(prefix="/api/akeneo", tags=["akeneo"])


@router.get("/status")
def get_status():
    status = akeneo_sync_status.get()
    status["configured"] = is_configured()
    return status


@router.post("/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    if not is_configured():
        return JSONResponse(status_code=400, content={"detail": "Akeneo credentials not configured"})
    if akeneo_sync_status.is_running:
        return JSONResponse(status_code=409, content={"detail": "Akeneo sync already in progress"})
    background_tasks.add_task(run_akeneo_sync)
    akeneo_sync_status.start()
    return {"message": "Akeneo sync started"}


@router.post("/preview")
def trigger_preview(background_tasks: BackgroundTasks):
    if not is_configured():
        return JSONResponse(status_code=400, content={"detail": "Akeneo credentials not configured"})
    if akeneo_preview_status.is_running:
        return JSONResponse(status_code=409, content={"detail": "Preview already in progress"})
    if akeneo_sync_status.is_running:
        return JSONResponse(status_code=409, content={"detail": "Sync is running, cannot preview"})
    background_tasks.add_task(run_akeneo_preview)
    akeneo_preview_status.start()
    return {"message": "Preview started"}


@router.get("/product/{sku}")
def get_akeneo_product(sku: str):
    """Temporary debug endpoint to inspect Akeneo product data."""
    if not is_configured():
        return JSONResponse(status_code=400, content={"detail": "Akeneo credentials not configured"})
    from services.akeneo_client import get_product
    product = get_product(sku)
    if product is None:
        return JSONResponse(status_code=404, content={"detail": "Product not found in Akeneo"})
    # Return just the values for promise_date and the attribute types
    values = product.get("values", {})
    return {
        "identifier": product.get("identifier"),
        "family": product.get("family"),
        "promise_date": values.get("promise_date"),
        "all_attribute_keys": list(values.keys()),
    }


@router.get("/preview/status")
def get_preview_status():
    status = akeneo_preview_status.get()
    if status["state"] == "completed":
        results = get_preview_results()
        status["results"] = results
        status["summary"] = {
            "total_changes": len(results),
        }
    return status
