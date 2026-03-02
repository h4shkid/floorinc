import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import init_db, sync_from_turso
from routers import forecast, lead_times, import_data, netsuite

CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

APP_PASSWORD = os.environ.get("APP_PASSWORD", "flooringinc2026")

app = FastAPI(title="FlooringInc Inventory Forecast", version="0.1.0")

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
app.include_router(import_data.router)
app.include_router(netsuite.router)


@app.on_event("startup")
def startup():
    sync_from_turso()
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/auth/verify")
def verify_auth():
    return {"status": "ok"}
