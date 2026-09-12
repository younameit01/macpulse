#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$DIR/.venv"
PYTHON="$VENV/bin/python"
UVICORN="$VENV/bin/uvicorn"
PYTEST="$VENV/bin/pytest"

case "$1" in
  setup)
    echo "[*] Setting up Python virtual environment..."
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -r "$DIR/backend/requirements.txt"
    echo "[*] Setting up Frontend dependencies..."
    (cd "$DIR/frontend" && npm install)
    echo "[+] Setup complete."
    ;;
  server)
    echo "[*] Starting FastAPI Coordinator on http://0.0.0.0:8000..."
    "$UVICORN" backend.main:app --host 0.0.0.0 --port 8000 --reload
    ;;
  frontend)
    echo "[*] Starting React dev server..."
    (cd "$DIR/frontend" && npm run dev)
    ;;
  agent)
    echo "[*] Starting MacAI Telemetry Agent..."
    "$PYTHON" -m agent.main
    ;;
  test)
    echo "[*] Running automated test suite..."
    "$PYTEST" "$DIR/tests/"
    ;;
  demo-load)
    echo "[*] Generating safe bounded I/O load..."
    "$PYTHON" "$DIR/scripts/demo_workload.py"
    ;;
  reset-demo)
    echo "[*] Resetting demo state..."
    "$PYTHON" "$DIR/scripts/demo_reset.py"
    ;;
  build)
    echo "[*] Building React frontend static bundle..."
    (cd "$DIR/frontend" && npm run build)
    ;;
  *)
    echo "Usage: ./run.sh {setup|server|frontend|agent|test|demo-load|reset-demo|build}"
    exit 1
    ;;
esac
