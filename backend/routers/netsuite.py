from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from services.netsuite_client import is_configured
from services.netsuite_sync import run_full_sync, run_sales_sync
from services.sync_status import sync_status

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
