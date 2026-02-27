import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, sync_from_turso
from routers import forecast, lead_times, import_data

CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

app = FastAPI(title="FlooringInc Inventory Forecast", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router)
app.include_router(lead_times.router)
app.include_router(import_data.router)


@app.on_event("startup")
def startup():
    sync_from_turso()
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}
