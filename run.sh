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
  demo-nfs-bg)
    echo "[*] Starting simulated NFS workload in background..."
    mkdir -p "$HOME/.macai"
    nohup "$PYTHON" -u "$DIR/scripts/demo_nfs_workload.py" > "$HOME/.macai/nfs_demo.log" 2>&1 &
    echo "[+] NFS workload running in background (PID: $!)."
    echo "    • Live logs : tail -f ~/.macai/nfs_demo.log"
    echo "    • Stop      : ./run.sh stop-nfs"
    ;;
  stop-nfs)
    echo "[*] Stopping background NFS workload..."
    pkill -f "scripts/demo_nfs_workload.py" 2>/dev/null && echo "[+] Stopped successfully." || echo "[!] NFS workload was not running."
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
  clean-cache)
    echo "[*] Cleaning Python and pytest caches..."
    find "$DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    rm -rf "$DIR/.pytest_cache" 2>/dev/null || true
    echo "[+] Cache files cleaned."
    ;;
  clean)
    echo "[*] Cleaning caches and build artifacts..."
    find "$DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    rm -rf "$DIR/.pytest_cache" "$DIR/frontend/dist" 2>/dev/null || true
    echo "[+] Clean complete."
    ;;
  help|--help|-h|"")
    echo "=========================================================================="
    echo "  MacPulse — Shell CLI Runner                                             "
    echo "=========================================================================="
    echo "Usage: ./run.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup            Create virtual environment and install dependencies"
    echo "  server           Launch central FastAPI coordinator on port 8000"
    echo "  frontend         Launch Vite React development server on port 5173"
    echo "  agent            Start local macOS telemetry collector"
    echo "  install-agent    Install native macOS launchd background service"
    echo "  uninstall-agent  Unload and remove native macOS launchd service"
    echo "  test             Run complete automated pytest test suite"
    echo "  status           Check status of coordinator port 8000 and launchd"
    echo "  lint             Run frontend linter (oxlint)"
    echo "  demo-load        Run safe bounded local I/O spike workload generator"
    echo "  demo-nfs         Run simulated Parallel NFS (pNFS) distributed workload"
    echo "  demo-nfs-bg      Start simulated NFS workload in background"
    echo "  stop-nfs         Stop background simulated NFS workload"
    echo "  reset-demo       Clean temporary files and reset demo workload state"
    echo "  build            Compile optimized static bundle in frontend/dist"
    echo "  clean-cache      Remove __pycache__, *.pyc, and .pytest_cache"
    echo "  clean            Deep clean: remove build artifacts, caches, and dist"
    echo "=========================================================================="
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run './run.sh help' or 'make help' for usage."
    exit 1
    ;;
esac

