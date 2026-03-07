import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import init_db, sync_from_cloud
from routers import forecast, lead_times, netsuite, inventory, akeneo, purchase_orders, chat

logger = logging.getLogger("uvicorn.error")

SYNC_INTERVAL_HOURS = int(os.environ.get("SYNC_INTERVAL_HOURS", "24"))

CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

APP_PASSWORD = os.environ.get("APP_PASSWORD", "flooringinc2026")

async def scheduled_sync_loop():
    """Run a full NetSuite sync every SYNC_INTERVAL_HOURS."""
    from services.netsuite_client import is_configured
    from services.netsuite_sync import run_full_sync
    from services.sync_status import sync_status

    # Wait before first scheduled sync (let startup finish)
    await asyncio.sleep(60)
    while True:
        try:
            await asyncio.sleep(SYNC_INTERVAL_HOURS * 3600)
            if is_configured() and not sync_status.is_running:
                logger.info("Starting scheduled full sync (every %dh)", SYNC_INTERVAL_HOURS)
                sync_status.start()
                await asyncio.to_thread(run_full_sync)
                logger.info("Scheduled sync completed")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Scheduled sync failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    sync_from_cloud()
    init_db()
    task = asyncio.create_task(scheduled_sync_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="FlooringInc Inventory Forecast", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path == "/api/health":
        return await call_next(request)
    if request.url.path.startswith("/api/"):
        token = request.headers.get("X-Auth-Token")
        if token != APP_PASSWORD:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)

app.include_router(forecast.router)
app.include_router(lead_times.router)
app.include_router(netsuite.router)
app.include_router(inventory.router)
app.include_router(akeneo.router)
app.include_router(purchase_orders.router)
app.include_router(chat.router)



@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/auth/verify")
def verify_auth():
    return {"status": "ok"}
