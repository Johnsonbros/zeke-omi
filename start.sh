#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ZEKE_DIR="$SCRIPT_DIR/zeke-core"

echo "Starting Zeke..."
echo "Working directory: $SCRIPT_DIR"

redis-server --daemonize yes --port 6379
echo "Redis started"

cd "$ZEKE_DIR"

python worker.py &
WORKER_PID=$!
echo "Celery worker started (PID: $WORKER_PID)"

python main.py &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

cd "$ZEKE_DIR/dashboard"
HOST=0.0.0.0 PORT=5000 npm run preview &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

wait $BACKEND_PID $FRONTEND_PID $WORKER_PID
