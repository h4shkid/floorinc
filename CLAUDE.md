# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack inventory forecasting app for FlooringInc. React/TypeScript frontend + Python/FastAPI backend with SQLite (Turso cloud sync).

## Repository Structure

- `/frontend` — React 19 + Vite + Tailwind CSS 4 + TypeScript
- `/backend` — Python FastAPI + SQLite + Pandas
- `/data` — Raw CSV data files for import
- `start.sh` — Launches both frontend and backend for local dev

## Development Commands

### Frontend (`/frontend`)
```bash
npm run dev        # Vite dev server on :5173 (proxies /api → localhost:8000)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint (flat config with React/TS plugins)
npm run preview    # Preview production build locally
```

### Backend (`/backend`)
```bash
uvicorn main:app --reload    # Dev server on :8000 with auto-reload
```

### Both
```bash
./start.sh    # Starts backend and frontend together
```

## Architecture

### Frontend
- Entry: `src/main.tsx` → `src/App.tsx` (LoginGate → AuthenticatedApp with tab routing)
- API client: `src/api/client.ts` — fetch wrapper that attaches `X-Auth-Token` from localStorage, auto-logs out on 401
- State: React hooks + Context (no external state library). `useForecast` hook manages dashboard state/loading
- TypeScript interfaces in `src/types/index.ts` mirror backend Pydantic schemas
- Components organized by feature: `Dashboard/`, `Filters/`, `LeadTimes/`, `Import/`

### Backend
- `main.py` — FastAPI app, CORS middleware, auth middleware, startup event (DB init + Turso sync)
- `database.py` — SQLite connection, schema initialization, Turso cloud sync
- `config.py` — Constants (DB_PATH, data paths, default window sizes)
- Routers: `routers/forecast.py`, `routers/lead_times.py`, `routers/import_data.py`
- Core business logic in `services/forecast_engine.py`: velocity calculation → seasonality adjustment → urgency classification (BACKORDER/RED/YELLOW/GREEN)
- Pydantic models in `models/schemas.py`

### API Endpoints
```
GET  /api/forecast/dashboard      — Paginated forecast with filters
GET  /api/forecast/summary        — Summary stats
GET  /api/forecast/{sku}/detail   — SKU detail with charts data
GET  /api/lead-times/             — List lead times
PUT  /api/lead-times/{sku}        — Update lead time
POST /api/import/inventory        — Upload inventory CSV
POST /api/import/sales            — Upload sales CSV
```

### Database
SQLite with four tables: `inventory`, `sales`, `lead_times`, `sku_insights`. Local file at `/backend/forecast.db` with automatic sync to Turso cloud (LibSQL) on startup and after data mutations.

### Auth
Shared password via `X-Auth-Token` header. Default password: `flooringinc2026` (override with `APP_PASSWORD` env var). Backend middleware protects all routes except `/api/health`.

## Key Environment Variables

**Backend:** `CORS_ORIGINS`, `APP_PASSWORD`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
**Frontend:** `VITE_API_URL`

## Deployment

- Frontend: Vercel (API calls rewritten to Render backend via `vercel.json`)
- Backend: Render (uvicorn on port 8000)

## TypeScript Config

Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` (use `import type` for type-only imports).
