#!/bin/bash
# Start house-lights dev environment
# Usage: ./dev.sh

REPO="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend (port 8002)..."
cd "$REPO/backend"
source .venv/bin/activate
uvicorn app.main:app --reload --port 8002 &
BACKEND_PID=$!

echo "Starting frontend (port 4322)..."
cd "$REPO/frontend"
npm run dev -- --port 4322 &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8002"
echo "  Frontend: http://localhost:4322"
echo "  API docs: http://localhost:8002/docs"
echo ""
echo "Press Ctrl+C to stop both."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
