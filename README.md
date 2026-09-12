# MacAI Storage Observatory

> **TTU HackWesTX 2026 • macOS AI File System Metrics Challenge**  
> Local-first macOS storage observability system for administrators running AI workloads across multiple Macs.

---

## Overview

MacAI Storage Observatory bridges the gap between fragmented macOS storage utilities (`df`, `mount`, `iostat`, `fs_usage`, `nfsstat`) and multi-machine AI operations. It answers:
- **What**: Which volumes (APFS or NFS) are nearing capacity or experiencing severe write pressure.
- **Where**: Which Mac host in the fleet is responsible.
- **Who**: Which process or user triggered the spike (best-effort attribution via elevated collector).
- **Why & Next**: A telemetry-grounded Gemini Explain summary with actionable next steps for the administrator.

---

## Architecture

```
                       ┌───────────────────────────────┐
                       │   React Admin Dashboard       │
                       │   (Fleet, Hosts, Volumes,     │
                       │    Explain Drawer, Charts)    │
                       └──────────────▲────────────────┘
                                      │ HTTP Polling (3s)
                       ┌──────────────▼────────────────┐
                       │   FastAPI Coordinator         │
                       │   ├── SQLite (WAL Mode)       │
                       │   ├── Rule & Baseline Engine  │
                       │   └── Gemini Explain Service  │
                       └──────▲───────────────▲────────┘
             Metrics / HB     │               │ Metrics / HB
      ┌───────────────────────┴─┐           ┌─┴───────────────────────┐
      │      Mac Agent A        │           │      Mac Agent B        │
      │  ├── Mount / APFS / NFS │           │  ├── Mount / APFS / NFS │
      │  ├── I/O Sampler        │           │  ├── I/O Sampler        │
      │  └── Process Collector  │           │  └── Process Collector  │
      └─────────────────────────┘           └─────────────────────────┘
```

---

## Repository Structure

```
├── agent/            # macOS storage, APFS/NFS, I/O, and process telemetry collectors
├── backend/          # Central coordinator: FastAPI, SQLite persistence, rule engine, Gemini Explain
├── frontend/         # React admin dashboard (JavaScript, dark glassmorphism, responsive SVG charts)
├── scripts/          # Safe demo load generator (demo_workload.py) & cleanup script (demo_reset.py)
├── tests/            # Automated test suite (backend endpoints, agent collectors)
├── Makefile          # Standardized make targets (make setup, server, agent, test, etc.)
├── run.sh            # Direct shell runner script
└── .env.example      # Environment variables template
```

---

## Quick Start

### 1. Prerequisites
- macOS machine (Apple Silicon or Intel)
- Python 3.10+
- Node.js 18+ and npm

### 2. Setup
Clone the repository and install all dependencies:
```bash
./run.sh setup
# or: make setup
```

### 3. Start Coordinator Server
In your first terminal:
```bash
./run.sh server
# or: make server
```
The coordinator will run on `http://localhost:8000`. If static frontend assets are built, visiting `http://localhost:8000` serves the web dashboard directly!

### 4. Start React Frontend (Dev Mode)
In your second terminal (optional if static build is served):
```bash
./run.sh frontend
# or: make frontend
```
Dashboard available at `http://localhost:5173`.

### 5. Start Telemetry Agent
On your primary Mac:
```bash
./run.sh agent
# or: make agent
```

---

## Remote Fleet Deployment (Zero-Git 1-Line Install)

To monitor additional Mac laptops across your local network without cloning Git or installing Node.js/frontend dependencies:

On any other Mac on the same Wi-Fi/LAN, simply run:
```bash
curl -fsSL http://<coordinator-ip>:8000/install | bash
# Example: curl -fsSL http://10.161.3.95:8000/install | bash
```

**What this does automatically:**
1. Downloads the lightweight agent bundle directly from the coordinator.
2. Sets up an isolated Python runtime in `~/.macai/agent`.
3. Registers Apple's native `launchd` background service (`~/Library/LaunchAgents/com.macai.storage.agent.plist`).
4. **Auto-starts on boot / wake-from-sleep** and automatically discovers the coordinator on the LAN.

*(If you already cloned the repository on the second Mac, you can run `./run.sh install-agent` instead).*

To check background agent logs on any client Mac:
```bash
tail -f ~/.macai/agent/agent.log
```
To uninstall:
```bash
./run.sh uninstall-agent
```

---

## Demo Scenarios

### Scenario 1: Safe Controlled I/O Spike & Anomaly Alert
To simulate an AI model training checkpoint write:
```bash
./run.sh demo-load
# or: make demo-load
```
1. Writes bounded temporary checkpoint chunks to `/tmp/macai_demo`.
2. Telemetry agent detects the write throughput spike (`MB/s`).
3. Coordinator rule engine compares against rolling baseline and fires an `abnormal_write` alert.
4. Click **"Explain with Gemini"** in the dashboard to see an explanation with measured evidence and recommended administrator checks.

### Scenario 2: Reset Demo State
To remove demo files and clean up:
```bash
./run.sh reset-demo
# or: make reset-demo
```

---

## Automated Tests

Run the unit and integration tests:
```bash
./run.sh test
# or: make test
```
All 6 test cases validate:
- Coordinator health and agent registration lifecycle
- Metric ingestion, capacity percentage calculations, and critical alerts
- Gemini Explain contract and deterministic local fallback
- macOS mount discovery (APFS/HFS/NFS) and I/O delta counters

---

## HackWesTX 2026 P0 Acceptance Checklist

| ID | Acceptance Criterion | Status | Evidence |
|---|---|---|---|
| AC-01 | Two real Macs appear online simultaneously | PASSED | Unique host UUID registration & heartbeat loop |
| AC-02 | APFS/local volume discovery with correct capacity | PASSED | `discover_mounts()` captures mount path, total, used, free |
| AC-03 | Team NFS mount detected as NFS | PASSED | `mount` parsing classifies `fs_type == "nfs"` & reads `nfsstat` |
| AC-04 | Controlled I/O visibly changes throughput | PASSED | Delta I/O sampler calculates `read_bps` and `write_bps` |
| AC-05 | Metric samples visible in historical chart | PASSED | SQLite `metric_samples` retained with time-series query |
| AC-06 | Abnormal-write or capacity rule produces alert | PASSED | Deterministic rule engine triggers warnings/critical alerts |
| AC-07 | Process attribution evidence | PASSED | Process collector maps active PID, process, and user |
| AC-08 | Gemini Explain returns telemetry-grounded explanation | PASSED | Section 8 payload policy with sanitized metadata & fallback |
| AC-09 | Stopping agent marks host offline after timeout | PASSED | Heartbeat liveness timeout (3 intervals) sets status offline |
| AC-10 | Gemini absence/outage does not crash monitoring | PASSED | Deterministic local fallback preserves full alert functionality |
| AC-11 | Reproducible setup via scripts/Makefile | PASSED | Single-command `./run.sh setup` & `Makefile` |
| AC-12 | Demo scripts do not write outside demo directory | PASSED | `demo_workload.py` bounded strictly to `/tmp/macai_demo` |

---

## Security & Privacy (PRD Section 15)

- **Sanitized Telemetry**: Only host alias, volume mount paths, bytes, and process names are transmitted.
- **No File Contents**: Document contents, weights, and dataset records are never read or uploaded to Gemini.
- **Non-Destructive**: The system is read-only and early-warning only; no automatic deletion or process killing.
