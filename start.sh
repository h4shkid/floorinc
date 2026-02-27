#!/bin/bash
# Start both backend and frontend

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting FlooringInc Inventory Forecast..."

# Backend
cd "$SCRIPT_DIR/backend"
python3 -m uvicorn main:app --port 8000 --reload &
BACKEND_PID=$!

# Frontend
cd "$SCRIPT_DIR/frontend"
npx vite --port 5173 &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both..."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
