# ==============================================================================
# MacPulse - Local-First macOS Storage Observability Platform
# TTU HackWesTX 2026 • macOS AI File System Metrics Challenge
# ==============================================================================

.PHONY: help setup server frontend agent agent-elevated install-agent uninstall-agent \
        test demo-load demo-nfs reset-demo build clean clean-cache status lint

VENV         ?= .venv
PYTHON       := $(VENV)/bin/python
PIP          := $(VENV)/bin/pip
UVICORN      := $(VENV)/bin/uvicorn
PYTEST       := $(VENV)/bin/pytest
HOST         ?= 0.0.0.0
PORT         ?= 8000
FRONTEND_DIR := frontend

# Default target
.DEFAULT_GOAL := help

# ------------------------------------------------------------------------------
# Help & Discovery
# ------------------------------------------------------------------------------
help:
	@echo "=========================================================================="
	@echo "  MacPulse — High-Performance macOS Storage Observability Platform        "
	@echo "=========================================================================="
	@echo "Usage: make [target]"
	@echo ""
	@echo "Core Targets:"
	@echo "  setup            Install Python (.venv) and Node (frontend) dependencies"
	@echo "  server           Start central FastAPI coordinator (http://$(HOST):$(PORT))"
	@echo "  frontend         Start React/Vite development server (http://localhost:5173)"
	@echo "  agent            Start local macOS telemetry agent in user mode"
	@echo "  agent-elevated   Start agent with sudo for fs_usage kernel process attribution"
	@echo "  build            Build production React bundle (served directly by FastAPI)"
	@echo ""
	@echo "Background Agent Daemon (macOS launchd):"
	@echo "  install-agent    Register and start native macOS launchd background agent"
	@echo "  uninstall-agent  Unload and remove launchd background agent"
	@echo ""
	@echo "Testing & Code Quality:"
	@echo "  test             Run pytest automated test suite (backend, auth, agents)"
	@echo "  lint             Run frontend code linter (oxlint)"
	@echo "  status           Display status of coordinator port, agents, and launchd"
	@echo ""
	@echo "Demo & Workload Simulation:"
	@echo "  demo-load        Run safe, bounded local I/O spike workload (/tmp/macai_demo)"
	@echo "  demo-nfs         Run simulated Parallel NFS (pNFS) distributed AI workload"
	@echo "  reset-demo       Clean temporary files and reset demo workload state"
	@echo ""
	@echo "Maintenance & Cleanup:"
	@echo "  clean-cache      Remove Python bytecode caches and pytest cache files"
	@echo "  clean            Remove build artifacts, frontend dist, and caches"
	@echo "=========================================================================="

# ------------------------------------------------------------------------------
# Environment Setup & Building
# ------------------------------------------------------------------------------
setup:
	@echo "[*] Setting up Python virtual environment ($(VENV))..."
	@test -d $(VENV) || python3 -m venv $(VENV)
	@$(PIP) install --quiet --upgrade pip
	@$(PIP) install -r backend/requirements.txt
	@echo "[*] Setting up Frontend dependencies in $(FRONTEND_DIR)..."
	@cd $(FRONTEND_DIR) && npm install
	@echo "[+] MacPulse setup completed successfully."

build:
	@echo "[*] Building React frontend static assets for production..."
	@cd $(FRONTEND_DIR) && npm run build
	@echo "[+] Frontend static build ready in $(FRONTEND_DIR)/dist. Coordinator will serve it at /."

# ------------------------------------------------------------------------------
# Service Execution
# ------------------------------------------------------------------------------
server:
	@echo "[*] Starting FastAPI Coordinator on http://$(HOST):$(PORT)..."
	@$(UVICORN) backend.main:app --host $(HOST) --port $(PORT) --reload --timeout-graceful-shutdown 1

frontend:
	@echo "[*] Starting React dev server on http://localhost:5173..."
	@cd $(FRONTEND_DIR) && npm run dev

agent:
	@echo "[*] Starting MacPulse Telemetry Agent (standard mode)..."
	@$(PYTHON) -m agent.main

agent-elevated:
	@echo "[*] Starting MacPulse Telemetry Agent with elevated privileges (sudo for fs_usage)..."
	@sudo $(PYTHON) -m agent.main

# ------------------------------------------------------------------------------
# Native macOS Background Daemon (launchd)
# ------------------------------------------------------------------------------
install-agent:
	@./scripts/install_launchd_agent.sh

uninstall-agent:
	@./scripts/uninstall_launchd_agent.sh

# ------------------------------------------------------------------------------
# Quality Assurance & Testing
# ------------------------------------------------------------------------------
test:
	@echo "[*] Running automated test suite with pytest..."
	@$(PYTEST) tests/

lint:
	@echo "[*] Running frontend linter..."
	@cd $(FRONTEND_DIR) && npm run lint

status:
	@echo "=========================================================================="
	@echo "  MacPulse System Status Check"
	@echo "=========================================================================="
	@printf "• Python Virtual Environment: "
	@if [ -d "$(VENV)" ]; then echo "OK ($(VENV))"; else echo "MISSING (run 'make setup')"; fi
	@printf "• Coordinator Port $(PORT): "
	@if lsof -i :$(PORT) >/dev/null 2>&1; then echo "LISTENING"; else echo "STOPPED"; fi
	@printf "• macOS launchd Agent: "
	@if launchctl list 2>/dev/null | grep -q "com.macai.storage.agent"; then echo "RUNNING (com.macai.storage.agent)"; else echo "NOT LOADED"; fi
	@printf "• Active Agent Log: "
	@if [ -f "$$HOME/.macai/agent.log" ]; then echo "$$HOME/.macai/agent.log (exists)"; \
	 elif [ -f "$$HOME/.macai/agent/agent.log" ]; then echo "$$HOME/.macai/agent/agent.log (exists)"; \
	 else echo "No active log file found"; fi
	@echo "=========================================================================="

# ------------------------------------------------------------------------------
# Demo & Workload Simulation
# ------------------------------------------------------------------------------
demo-load:
	@echo "[*] Generating safe bounded I/O load in /tmp/macai_demo..."
	@$(PYTHON) scripts/demo_workload.py

demo-nfs:
	@echo "[*] Generating simulated Parallel NFS (pNFS) distributed workload..."
	@$(PYTHON) scripts/demo_nfs_workload.py

reset-demo:
	@echo "[*] Resetting local demo files and simulated NFS state..."
	@$(PYTHON) scripts/demo_reset.py
	@$(PYTHON) scripts/demo_nfs_workload.py --clean

# ------------------------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------------------------
clean-cache:
	@echo "[*] Cleaning Python and pytest caches..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@rm -rf .pytest_cache 2>/dev/null || true
	@echo "[+] Cache files cleaned."

clean: clean-cache
	@echo "[*] Cleaning frontend build output..."
	@rm -rf $(FRONTEND_DIR)/dist 2>/dev/null || true
	@echo "[+] Cleanup complete."
