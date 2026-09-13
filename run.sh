#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$DIR/.venv"
PYTHON="$VENV/bin/python"
UVICORN="$VENV/bin/uvicorn"
PYTEST="$VENV/bin/pytest"
PORT="${PORT:-8000}"

case "$1" in
  setup)
    echo "[*] Setting up Python virtual environment..."
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install --quiet --upgrade pip
    "$VENV/bin/pip" install -r "$DIR/backend/requirements.txt"
    echo "[*] Setting up Frontend dependencies..."
    (cd "$DIR/frontend" && npm install)
    echo "[+] Setup complete."
    ;;
  server)
    echo "[*] Starting FastAPI Coordinator on http://0.0.0.0:${PORT}..."
    "$UVICORN" backend.main:app --host 0.0.0.0 --port "${PORT}" --reload --timeout-graceful-shutdown 1
    ;;
  frontend)
    echo "[*] Starting React dev server on http://localhost:5173..."
    (cd "$DIR/frontend" && npm run dev)
    ;;
  agent)
    echo "[*] Starting MacPulse Telemetry Agent..."
    "$PYTHON" -m agent.main
    ;;
  agent-elevated)
    echo "[*] Starting MacPulse Telemetry Agent with sudo (elevated fs_usage collector)..."
    sudo "$PYTHON" -m agent.main
    ;;
  install-agent)
    "$DIR/scripts/install_launchd_agent.sh"
    ;;
  uninstall-agent)
    "$DIR/scripts/uninstall_launchd_agent.sh"
    ;;
  test)
    echo "[*] Running automated test suite..."
    "$PYTEST" "$DIR/tests/"
    ;;
  lint)
    echo "[*] Running frontend linter..."
    (cd "$DIR/frontend" && npm run lint)
    ;;
  status)
    echo "=========================================================================="
    echo "  MacPulse System Status Check"
    echo "=========================================================================="
    printf "• Python Virtual Environment: "
    if [ -d "$VENV" ]; then echo "OK ($VENV)"; else echo "MISSING (run ./run.sh setup)"; fi
    printf "• Coordinator Port ${PORT}: "
    if lsof -i :${PORT} >/dev/null 2>&1; then echo "LISTENING"; else echo "STOPPED"; fi
    printf "• macOS launchd Agent: "
    if launchctl list 2>/dev/null | grep -q "com.macai.storage.agent"; then echo "RUNNING (com.macai.storage.agent)"; else echo "NOT LOADED"; fi
    printf "• Active Agent Log: "
    if [ -f "$HOME/.macai/agent.log" ]; then echo "$HOME/.macai/agent.log (exists)"; \
    elif [ -f "$HOME/.macai/agent/agent.log" ]; then echo "$HOME/.macai/agent/agent.log (exists)"; \
    else echo "No active log file found"; fi
    echo "=========================================================================="
    ;;
  demo-load)
    echo "[*] Generating safe bounded I/O load..."
    "$PYTHON" "$DIR/scripts/demo_workload.py"
    ;;
  demo-nfs)
    echo "[*] Generating simulated NFS/pNFS protocol workload..."
    "$PYTHON" "$DIR/scripts/demo_nfs_workload.py"
    ;;
  reset-demo)
    echo "[*] Resetting demo state..."
    "$PYTHON" "$DIR/scripts/demo_reset.py"
    "$PYTHON" "$DIR/scripts/demo_nfs_workload.py" --clean
    ;;
  build)
    echo "[*] Building React frontend static bundle..."
    (cd "$DIR/frontend" && npm run build)
    ;;
  clean)
    echo "[*] Cleaning caches and build artifacts..."
    find "$DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    rm -rf "$DIR/.pytest_cache" "$DIR/frontend/dist" 2>/dev/null || true
    echo "[+] Clean complete."
    ;;
  *)
    echo "Usage: ./run.sh {setup|server|frontend|agent|agent-elevated|install-agent|uninstall-agent|test|lint|status|demo-load|demo-nfs|reset-demo|build|clean}"
    exit 1
    ;;
esac
