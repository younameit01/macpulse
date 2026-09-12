.PHONY: help setup server frontend agent test demo-load reset-demo build

VENV = .venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
UVICORN = $(VENV)/bin/uvicorn
PYTEST = $(VENV)/bin/pytest

help:
	@echo "MacAI Storage Observatory - Available Commands:"
	@echo "  make setup       - Install Python and Node dependencies"
	@echo "  make server      - Start central FastAPI coordinator (port 8000)"
	@echo "  make frontend    - Start React admin dashboard development server"
	@echo "  make agent       - Start local macOS storage telemetry agent"
	@echo "  make test        - Run test suite"
	@echo "  make demo-load   - Run safe, bounded temporary I/O workload generator"
	@echo "  make reset-demo  - Clean temporary demo files"
	@echo "  make build       - Build production bundle of React dashboard"

setup:
	@echo "[*] Setting up Python virtual environment..."
	@python3 -m venv $(VENV)
	@$(PIP) install -r backend/requirements.txt
	@echo "[*] Setting up Frontend dependencies..."
	@cd frontend && npm install
	@echo "[+] Setup completed successfully."

server:
	@echo "[*] Starting FastAPI Coordinator on http://0.0.0.0:8000..."
	@$(UVICORN) backend.main:app --host 0.0.0.0 --port 8000 --reload

frontend:
	@echo "[*] Starting React dev server..."
	@cd frontend && npm run dev

agent:
	@echo "[*] Starting MacAI Telemetry Agent..."
	@$(PYTHON) -m agent.main

test:
	@echo "[*] Running automated test suite..."
	@$(PYTEST) tests/

demo-load:
	@echo "[*] Generating safe bounded I/O load..."
	@$(PYTHON) scripts/demo_workload.py

reset-demo:
	@echo "[*] Resetting demo state..."
	@$(PYTHON) scripts/demo_reset.py

build:
	@echo "[*] Building React frontend static assets..."
	@cd frontend && npm run build

install-agent:
	@./scripts/install_launchd_agent.sh

uninstall-agent:
	@./scripts/uninstall_launchd_agent.sh
