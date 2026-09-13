# MacPulse

<div align="center">

**Enterprise macOS Storage Observability & AI Workload Telemetry Platform**  
*Local-first, real-time APFS/NFS filesystem intelligence, Apple Silicon NVMe health diagnostics, kernel-level process attribution, dynamic anomaly alerts, and telemetry-grounded Gemini root-cause analysis.*

**TTU HackWesTX 2026 • macOS AI File System Metrics Challenge**

[![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-black?logo=apple&logoColor=white)](#prerequisites)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](#prerequisites)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](#system-architecture)
[![React](https://img.shields.io/badge/React-19.2%20%7C%20Vite%208-61DAFB?logo=react&logoColor=black)](#system-architecture)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-black?logo=threedotjs&logoColor=white)](#interactive-3d-hero-command-center)
[![Auth0](https://img.shields.io/badge/Auth0-RBAC%20%26%20SSO-EB5424?logo=auth0&logoColor=white)](#enterprise-auth0--rbac-management)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-8E75B2?logo=google&logoColor=white)](#telemetry-grounded-gemini-explain-service)
[![Tests](https://img.shields.io/badge/Pytest-25%20Passed-brightgreen?logo=pytest&logoColor=white)](#automated-testing--validation)
[![Remote Install](https://img.shields.io/badge/Deployment-1--Command%20Curl%20Install-orange)](#remote-fleet-deployment-1-command-curl-install)
[![Architecture](https://img.shields.io/badge/Architecture-Hub%20%26%20Spoke-blue)](#system-architecture)

</div>

---

## Table of Contents

1. [Overview & Problem Statement](#overview--problem-statement)
2. [System Architecture](#system-architecture)
3. [Key Features](#key-features)
   - [Multi-Host Fleet Observability & Zero-Config Discovery](#1-multi-host-fleet-observability--zero-config-discovery)
   - [1-Command Remote Mac Onboarding (`curl | bash`)](#2-1-command-remote-mac-onboarding-curl--bash)
   - [Native macOS Background Daemon (`launchd`)](#3-native-macos-background-daemon-launchd)
   - [Dual-Protocol Storage Telemetry (APFS & NFS/pNFS)](#4-dual-protocol-storage-telemetry-apfs--nfspnfs)
   - [Apple Silicon NVMe SMART Health & Unified Memory Pressure](#5-apple-silicon-nvme-smart-health--unified-memory-pressure)
   - [Process Attribution & Activity Tracing (Who & What)](#6-process-attribution--activity-tracing-who--what)
   - [Rolling Statistical Baselines & Anomaly Alert Engine](#7-rolling-statistical-baselines--anomaly-alert-engine)
   - [Telemetry-Grounded Gemini Explain Service](#8-telemetry-grounded-gemini-explain-service)
   - [Enterprise Auth0 & RBAC Management](#9-enterprise-auth0--rbac-management)
   - [Interactive 3D Hero Command Center](#10-interactive-3d-hero-command-center)
4. [Repository Layout](#repository-layout)
5. [Prerequisites & Environment Configuration](#prerequisites--environment-configuration)
6. [Quick Start Guide](#quick-start-guide)
7. [Remote Fleet Deployment (1-Command Curl Install)](#remote-fleet-deployment-1-command-curl-install)
8. [Demo & Simulation Scenarios](#demo--simulation-scenarios)
9. [REST API Reference](#rest-api-reference)
10. [Makefile & CLI Reference](#makefile--cli-reference)
11. [Automated Testing & Validation](#automated-testing--validation)

---

## Overview & Problem Statement

Modern AI engineering frequently involves running training runs, fine-tuning checkpoints, dataset staging, and inference workloads locally across clusters of macOS machines (Mac Studios, Mac Minis, and Apple Silicon MacBook Pros). However, storage observability on macOS has historically suffered from acute fragmentation:

- **Fragmented Tooling**: Administrators must manually juggle incompatible CLI tools (`df`, `mount`, `iostat`, `fs_usage`, and `nfsstat`), none of which correlate metrics across machines or over time.
- **Silent Degradation**: APFS Copy-on-Write (CoW) snapshots, heavy AI checkpoint write bursts, and NFS RPC timeouts silently degrade model training without obvious system alerts.
- **Apple Silicon NVMe Wear**: Intensive model caching and tensor checkpointing aggressively consume internal NVMe flash write cycles (Total Bytes Written / TBW), risking permanent drive degradation without proactive wear-leveling monitoring.
- **Attribution Gap**: Standard monitoring tools report disk utilization spikes, but fail to pinpoint *which* PID, executable (e.g. `python3`, `ollama`, `mlx`, `pytorch`), or user triggered the I/O event.

**MacPulse** resolves these challenges by delivering a unified, local-first control plane that automatically discovers Apple Silicon and Intel Macs across the local network, gathers kernel-level filesystem metrics with negligible overhead (~0.2% CPU), detects baseline deviations, and provides grounded root-cause explanations via Google Gemini.

---

## System Architecture

MacPulse is engineered around the **Hub-and-Spoke (Central Coordinator)** architectural pattern:
- **Central Coordinator ("Hub")**: The central control plane powered by FastAPI and SQLite (WAL mode). It orchestrates fleet auto-discovery via secure UDP LAN beacons, ingests time-series telemetry from across the fleet, computes rolling statistical baselines, manages Auth0 RBAC, triggers grounded Gemini explanations, and streams live telemetry to client dashboards via Server-Sent Events (SSE).
- **Edge Mac Agents ("Spokes")**: Autonomous, lightweight native daemons (`launchd`) deployed across monitored macOS machines. Each agent independently samples local APFS containers, NVMe SMART wear-leveling, NFS RPC metrics, and kernel-level process attribution with negligible footprint (~0.2% CPU), pushing structured heartbeats and metrics to the central coordinator.

```
                                  ┌────────────────────────────────────────┐
                                  │       React 19 Admin Dashboard         │
                                  │   ├── Three.js Dynamic WebGL Mesh      │
                                  │   ├── Live Storage Gauges & Sparklines │
                                  │   ├── Interactive Host & Volume Views  │
                                  │   ├── Grounded Gemini Explain Drawer   │
                                  │   └── Auth0 RBAC & Admin Management    │
                                  └───────────────────▲────────────────────┘
                                                      │ Server-Sent Events (SSE Stream 2s)
                                  ┌───────────────────▼────────────────────┐
                                  │          FastAPI Coordinator           │
                                  │   ├── SQLite Persistence (WAL Mode)    │
                                  │   ├── Dynamic Baseline & Alert Engine  │
                                  │   ├── UDP LAN Beacon Auto-Discovery    │
                                  │   ├── 1-Line Remote Agent Server       │
                                  │   ├── Auth0 RBAC & Multi-Admin Engine  │
                                  │   └── Gemini 2.5 Explain Service       │
                                  └───────────▲────────────────▲───────────┘
                       Heartbeat / Telemetry  │                │  Heartbeat / Telemetry
                                  ┌───────────┴─┐            ┌─┴───────────┐
                                  │ Mac Agent A │            │ Mac Agent B │
                                  │ (Primary)   │            │ (Remote)    │
                                  └──────┬──────┘            └──────┬──────┘
                                         │                          │
                 ┌───────────────────────┴──────────────────────────┴───────────────────────┐
                 │                          Agent Collectors Layer                         │
                 │  • Host & Volume Mounts: APFS Containers, HFS+, NFSv3/v4/pNFS Exports   │
                 │  • NVMe SMART Metrics: Wear-Leveling %, Drive Temp, Controller Health   │
                 │  • System Resource Stats: Unified Memory Pressure, Core Load, Uptime    │
                 │  • I/O Performance: Delta Throughput (read_bps, write_bps, IOPS)        │
                 │  • Process Attribution: Process I/O, open files & active PID tracking   │
                 │  • Network Storage: NFS RPC calls, timeouts, badcalls, retransmissions  │
                 └─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Multi-Host Fleet Observability & Zero-Config Discovery
- **Hub-and-Spoke Topology**: Decouples edge telemetry collection across remote Macs (spokes) from centralized analytics, dynamic baseline computation, and alerting at the coordinator (hub).
- Automatically aggregates storage metrics across heterogeneous macOS machines into a single unified control plane.
- **Zero-Configuration UDP LAN Beacon**: The coordinator continuously runs a secure UDP discovery responder on port `8765`. Client agents broadcast a discovery ping on startup, resolve the coordinator's LAN IP address automatically, and begin streaming telemetry without requiring manual IP configuration.
- **Liveness Monitoring**: Tracks heartbeats on 3-second intervals; automatically flags nodes as `offline` if 3 consecutive heartbeats are missed.

### 2. 1-Command Remote Mac Onboarding (`curl | bash`)
- **Zero-Setup Client Bootstrapping**: Add any secondary or tertiary Mac (Studio, Mini, MacBook) to the monitoring cluster in seconds without cloning the Git repository or installing Node.js.
- **Self-Contained Automated Installer**: Running `curl -fsSL http://<coordinator-ip>:8000/install | bash` streams an in-memory tarball directly from `/agent-bundle.tar.gz`, builds an isolated Python runtime at `~/.macai/agent`, registers the service, and begins real-time telemetry streaming.

### 3. Native macOS Background Daemon (`launchd`)
- Implements Apple's native process lifecycle manager (`~/Library/LaunchAgents/com.macai.storage.agent.plist`).
- Persists across reboots, user logouts, and wake-from-sleep events.
- Writes structured logs to `~/.macai/agent/agent.log` with automatic error capture in `agent.err`.

### 4. Dual-Protocol Storage Telemetry (APFS & NFS/pNFS)
- **Local APFS / HFS+**: Captures total storage, used blocks, available capacity, mount points, and filesystem flags. Color-coded thresholds trigger warnings at **85% capacity** and critical alerts at **95% capacity**.
- **Remote NFS & Parallel NFS (pNFS)**: Automatically identifies network mounts, mounts exported via remote NAS / Linux storage nodes, tracks RPC operation counts, bad calls, timeouts, and network retransmissions.

### 5. Apple Silicon NVMe SMART Health & Unified Memory Pressure
- **NVMe SMART Diagnostics**: Inspects internal Apple Silicon SSD health metrics including wear-leveling percentage, remaining drive life, internal controller temperature (°C), and critical hardware warning bitmasks.
- **Unified Memory & CPU Telemetry**: Tracks macOS memory allocation across wired memory, active pages, compressed memory cache, and swap usage, correlated with 1-minute, 5-minute, and 15-minute CPU load averages.

### 6. Process Attribution & Activity Tracing (Who & What)
- Continuously tracks active process I/O, open files, and execution footprint via lightweight, non-intrusive `psutil` collectors without requiring `sudo` privileges.
- Pinpoints the exact PID, executable binary (e.g. `python3`, `ollama`, `mlx`), execution command, and macOS username responsible for high-throughput write bursts.

### 7. Rolling Statistical Baselines & Anomaly Alert Engine
- Maintains a rolling 5-minute sliding statistical window of I/O metrics per volume.
- Automatically generates deterministic alerts for:
  - `abnormal_write`: Write throughput exceeding rolling statistical baseline by >300%.
  - `io_saturation`: Read/write operations exceeding disk subsystem queues.
  - `capacity_warning` / `capacity_critical`: Volume utilization crossing 85% and 95% thresholds.
- **Alert Deduplication & Auditing**: Grouping logic consolidates repeated spikes from batch jobs to prevent alert fatigue. Supports full administrative resolution workflows with audit notes and status tracking.

### 8. Telemetry-Grounded Gemini Explain Service
- Context-aware root cause analysis powered by Google Gemini (`gemini-2.5-flash`).
- Formulates grounded hypotheses directly from measured telemetry evidence (exact volume path, throughput deltas, attribution PID, SMART temperature).
- **Strict Privacy Guarantees (PRD Section 15)**: Zero document contents, weights, or source code are ever read or transmitted. Only sanitized telemetry metadata is sent.
- **Air-Gapped Local Fallback**: If the Gemini API is unreachable, unconfigured, or offline, a local deterministic explanation engine immediately generates structured diagnostics, ensuring zero disruption to monitoring.

### 9. Enterprise Auth0 & RBAC Management
- Native Auth0 integration supporting Role-Based Access Control (`Super Admin` vs. `Admin`).
- Automated multi-admin invitations: Generates secure onboarding ticket links via Auth0 Management API.
- **Offline / Dev Fallback**: Fully functional offline development mode with simulated JWT authentication for air-gapped or testing environments.

### 10. Interactive 3D Hero Command Center
- Built with **Three.js (WebGL)**: An interactive 3D particle grid and wireframe network topology mesh dynamically reacts to real-time cluster storage throughput.
- Dark glassmorphism interface with SVG sparklines, tabbed machine views, granular hardware gauges, and slide-over investigation drawers.
- **Pure Server-Sent Events (SSE) Real-Time Telemetry**: The React dashboard receives live fleet overview updates via continuous **Server-Sent Events (SSE)** on `/api/v1/stream/overview` at 2-second push intervals with automatic client reconnection, eliminating redundant HTTP polling overhead. Detailed Host and Volume drill-downs load samples on demand.

---

## Repository Layout

```
mac_observatory/
├── Makefile                          # Standardized command palette (setup, server, agent, test, etc.)
├── run.sh                            # Portable shell runner with full Makefile feature-parity
├── pytest.ini                        # Pytest configuration and warning filters
├── .env.example                      # Environment variables reference template
│
├── agent/                            # Local macOS Telemetry Collector
│   ├── main.py                       # Agent lifecycle daemon, telemetry loop, and reporting
│   ├── client.py                     # HTTP ingestion and heartbeat client
│   ├── config.py                     # Agent configuration and environment variable parsing
│   ├── discovery.py                  # UDP LAN auto-discovery listener
│   ├── identity.py                   # Unique hardware UUID and host metadata extractor
│   └── collectors/                   # Specialized metric collection modules
│       ├── mounts.py                 # APFS / HFS+ / NFS mount points and capacity discovery
│       ├── io_stats.py               # Disk read/write byte deltas and throughput calculation
│       ├── nfs_stats.py              # NFS RPC operations, timeouts, and network retransmissions
│       ├── smart_stats.py            # Apple Silicon NVMe wear-leveling, temp, and SMART health
│       ├── system_stats.py           # Unified memory pressure, CPU core load, and system uptime
│       └── process_usage.py          # Active process inspection and filesystem attribution
│
├── backend/                          # Central FastAPI Coordinator & Analytics Engine
│   ├── main.py                       # FastAPI application entrypoint, lifespan, and static mounting
│   ├── database.py                   # SQLite engine with Write-Ahead Logging (WAL) configuration
│   ├── models.py                     # SQLAlchemy ORM schemas (Host, Volume, MetricSample, Alert, Admin)
│   ├── schemas.py                    # Pydantic v2 validation models for request/response serialization
│   ├── engine.py                     # Rolling baseline calculation and deterministic rule engine
│   ├── alert_utils.py                # Alert deduplication and consolidation logic
│   ├── auth.py                       # Auth0 JWT verification, RBAC guards, and dev mock auth
│   ├── discovery.py                  # UDP LAN auto-discovery beacon broadcaster
│   ├── routes/                       # Modular API router endpoints
│   │   ├── health.py                 # Coordinator health check (/health)
│   │   ├── installer.py              # 1-line curl remote installer (/install, /agent-bundle.tar.gz)
│   │   ├── ingest.py                 # Telemetry ingestion endpoint (/api/v1/ingest/metrics)
│   │   ├── agents.py                 # Agent registration and heartbeat (/api/v1/agents/*)
│   │   ├── overview.py               # Fleet overview, KPI rollups, and capacity aggregates
│   │   ├── hosts.py                  # Host detail and machine hardware health endpoints
│   │   ├── volumes.py                # Discovered volume listings and time-series query endpoints
│   │   ├── alerts.py                 # Alert listings, manual resolution, and Gemini Explain trigger
│   │   ├── auth_routes.py            # User management, admin invites, and authentication endpoints
│   │   └── stream.py                 # Server-Sent Events (SSE) live event stream
│   └── services/
│       └── gemini_service.py         # Google Gemini integration with deterministic local fallback
│
├── frontend/                         # React 19 Admin Dashboard (Vite 8)
│   ├── index.html                    # Single-page application entrypoint
│   ├── vite.config.js                # Vite build and proxy configuration
│   ├── package.json                  # Frontend dependencies (React 19, Three.js, Lucide, Auth0)
│   └── src/
│       ├── main.jsx                  # React application root
│       ├── App.jsx                   # Central layout, state management, and real-time SSE stream subscriber
│       ├── api.js                    # Axios/Fetch API wrapper for coordinator endpoints
│       ├── alertUtils.js             # Client-side alert grouping and badge color helpers
│       ├── auth/                     # Auth0 context provider and login state hooks
│       └── components/               # Modular UI presentation components
│           ├── MacPulseBackground.jsx# Three.js 3D WebGL hero background animation
│           ├── Header.jsx            # Cluster status header, node switcher, and user avatar
│           ├── KpiCards.jsx          # Fleet aggregate KPI cards (online nodes, capacity, active alerts)
│           ├── MachineTabs.jsx       # Tabbed navigation between fleet overview and individual Macs
│           ├── MachineOverviewCard.jsx # Host metadata, kernel version, and hardware badges
│           ├── HostDetail.jsx        # Detailed single-host telemetry, mounts, and hardware diagnostics
│           ├── VolumeDetail.jsx      # Historical volume I/O throughput graphs and attribution log
│           ├── StorageCapacityCard.jsx # APFS / NFS capacity gauges with 85%/95% thresholds
│           ├── HardwareHealthCard.jsx  # NVMe wear percentage, SSD life, and temperature
│           ├── SystemResourcesCard.jsx # Unified memory pressure, CPU load, and uptime
│           ├── FleetIoCard.jsx       # Fleet-wide aggregate throughput graphs
│           ├── ActiveVolumesCard.jsx # Granular table of discovered volumes and mount flags
│           ├── RecentAlertsCard.jsx  # Live alert feed with quick-resolve buttons
│           ├── AlertDrawer.jsx       # Detailed alert inspection drawer with Gemini Explain
│           ├── ResolveAlertModal.jsx # Admin resolution dialog with note capture
│           ├── SignInScreen.jsx      # Auth0 SSO and local login portal
│           ├── CreateAdminView.jsx   # Super Admin invite link generation dialog
│           └── AcceptInviteScreen.jsx# Admin invitation onboarding flow
│
├── scripts/                          # Workload Simulation & Daemon Control Scripts
│   ├── demo_workload.py              # Safe bounded local I/O spike generator (/tmp/macai_demo)
│   ├── demo_nfs_workload.py          # Simulated Parallel NFS (pNFS) distributed AI workload
│   ├── demo_reset.py                 # Safe cleanup script for temporary files and demo state
│   ├── install_launchd_agent.sh      # Native macOS launchd service installer
│   └── uninstall_launchd_agent.sh    # Native macOS launchd service uninstaller
│
└── tests/                            # Automated Pytest Suite (24 Test Cases)
    ├── test_agent.py                 # Unit tests for mount discovery, I/O samplers, and fallbacks
    ├── test_backend.py               # Integration tests for coordinator API, ingest, and Gemini Explain
    └── test_auth_and_alerts.py       # Auth0 RBAC, invite tokens, alert deduplication, and resolution
```

---

## Prerequisites & Environment Configuration

### Hardware & Operating System
- **Supported OS**: macOS 13 (Ventura), macOS 14 (Sonoma), macOS 15 (Sequoia)
- **Supported Architectures**: Apple Silicon (M1, M2, M3, M4 across Pro/Max/Ultra) and Intel x86_64

### Software Requirements
- **Python**: 3.10 or newer (tested with Python 3.10 – 3.13)
- **Node.js & npm**: Node 18+ and npm 9+

### Environment Configuration (`.env`)
Create your local environment file by copying `.env.example`:
```bash
cp .env.example .env
```

| Variable | Type | Default | Description |
|---|---|---|---|
| `MACAI_COORDINATOR_URL` | URL | `http://localhost:8000` | Target URL where agents transmit heartbeats and telemetry |
| `MACAI_SAMPLE_INTERVAL_SECONDS` | Integer | `3` | Telemetry polling and transmission frequency in seconds |
| `MACAI_DB_PATH` | Path | `macai_observatory.db` | Local SQLite database file location (configured with WAL mode) |
| `MACAI_DEMO_DIR` | Path | `/tmp/macai_demo` | Bounded scratch directory for safe workload simulations |
| `GEMINI_API_KEY` | String | *(Optional)* | Google AI Studio API key for Gemini 2.5 Flash explanations |
| `GEMINI_MODEL` | String | `gemini-2.5-flash` | Gemini model target for telemetry analysis |
| `VITE_AUTH0_DOMAIN` | String | *(Optional)* | Auth0 tenant domain (e.g. `your-tenant.us.auth0.com`) |
| `VITE_AUTH0_CLIENT_ID` | String | *(Optional)* | Auth0 application client ID for Single Sign-On |
| `AUTH0_MANAGEMENT_CLIENT_ID` | String | *(Optional)* | Auth0 M2M Client ID for automated admin invite ticket generation |
| `AUTH0_MANAGEMENT_CLIENT_SECRET`| String | *(Optional)* | Auth0 M2M Client Secret |
| `PORT` | Integer | `8000` | HTTP port for the FastAPI coordinator |

> [!NOTE]
> All external services (Google Gemini and Auth0) have built-in zero-dependency local fallbacks. If API keys are omitted, the application runs fully offline in development mode.

---

## Quick Start Guide

> [!TIP]
> **No Xcode Command Line Tools or `make` installed?** You can run `./run.sh <command>` with 100% feature-parity across all targets (e.g. `./run.sh setup`, `./run.sh server`, `./run.sh frontend`, `./run.sh agent`).

### Step 1: Install Dependencies
Run the unified setup command to install Python dependencies in `.venv` and Node packages in `frontend/`:
```bash
make setup
# or: ./run.sh setup
```

### Step 2: Start Coordinator Server
Launch the central FastAPI coordinator:
```bash
make server
# or: ./run.sh server
```
The coordinator initializes the SQLite database with WAL mode and begins broadcasting the UDP auto-discovery beacon on `http://0.0.0.0:8000`.

### Step 3: Start Admin Dashboard
In a second terminal, launch the React development server:
```bash
make frontend
# or: ./run.sh frontend
```
Visit `http://localhost:5173` to open the MacPulse dashboard.

*(Alternative Single-Port Deployment: Run `make build` and start `make server`. FastAPI will serve the compiled React dashboard directly at `http://localhost:8000`!)*

### Step 4: Start Telemetry Agent

You can run the telemetry agent in **interactive foreground mode** for immediate testing, or install it as a **persistent background daemon**:

#### Option A: Interactive Foreground Mode (Quick Development & Testing)
Runs directly in your terminal and streams live collection logs to stdout:
```bash
make agent
# or: ./run.sh agent
```
*Within 3 seconds, your Mac will register via UDP auto-discovery and begin streaming real-time storage metrics to the dashboard!*

#### Option B: Native macOS Background Service (`launchd`)
Runs continuously in the background without needing an open terminal, auto-starts on boot, and reconnects on wake-from-sleep:

- **Local Machine (from this repository)**:
  ```bash
  make install-agent
  # or: ./run.sh install-agent
  ```
- **Remote Mac on Wi-Fi / LAN (1-Command Curl Install)**:
  ```bash
  curl -fsSL http://<coordinator-ip>:8000/install | bash
  ```

> [!TIP]
> **Where does `<coordinator-ip>` come from?**
> The `<coordinator-ip>` is the local network IP address of the primary Mac where `make server` (or `./run.sh server`) is running:
> - **Find it on the primary Mac**: Run `ipconfig getifaddr en0` (or `en1` depending on your active Wi-Fi / Ethernet interface).
> - **Check coordinator logs**: When launching `make server`, the console automatically prints:
>   `Coordinator auto-discovery beacon listening on UDP 0.0.0.0:8765 (LAN: <coordinator-ip>)`
> - **Local testing**: If testing on the same machine running the server, simply use `localhost` (`http://localhost:8000/install`).

#### How to Stop & Uninstall the Agent:
To stop the background collector and remove it from macOS `launchd`:

- **Local Machine (from this repository)**:
  ```bash
  make uninstall-agent
  # or: ./run.sh uninstall-agent
  ```
- **Remote Mac (1-Command Curl Uninstall)**:
  ```bash
  curl -fsSL http://<coordinator-ip>:8000/uninstall | bash
  ```

#### What Both Commands Do:
- **`install-agent` (or 1-line `curl .../install`)**: Creates a native Apple LaunchAgent service at `~/Library/LaunchAgents/com.macai.storage.agent.plist`, launches the collector process in the background, redirects structured logs to `~/.macai/agent.log` (with errors in `agent.err`), and sets `KeepAlive` and `RunAtLoad` so telemetry resumes automatically after reboots or sleep events.
- **`uninstall-agent` (or 1-line `curl .../uninstall`)**: Safely signals the running agent process to shut down gracefully, unloads it from Apple's `launchctl` service registry, and cleans up the `.plist` service definition and installed agent files without touching any user data or system configurations.

---

## Remote Fleet Deployment (1-Command Curl Install)

To monitor additional Mac laptops or Mac Studios across your local network without cloning Git or installing Node.js/frontend dependencies:

### 1. Identify the Coordinator IP
On your primary Mac running the central server (`make server`), find your LAN IP address:
```bash
ipconfig getifaddr en0
# Example output: 10.161.3.95
```
*(The coordinator also logs this IP on startup in the `make server` terminal).*

### 2. Run the 1-Line Onboarding Command
On any other Mac connected to the same Wi-Fi or local network:
```bash
curl -fsSL http://<coordinator-ip>:8000/install | bash
# Example: curl -fsSL http://10.161.3.95:8000/install | bash
```

### What Happens Automatically:
1. **Pulls Agent Bundle**: Fetches a lightweight, self-contained tarball directly from the coordinator (`/agent-bundle.tar.gz`).
2. **Creates Runtime**: Builds an isolated Python virtual environment at `~/.macai/agent/.venv` with only `psutil` and `httpx`.
3. **Registers `launchd` Service**: Installs `~/Library/LaunchAgents/com.macai.storage.agent.plist`.
4. **Auto-Starts on Boot**: Configured with `RunAtLoad` and `KeepAlive` to run continuously, restart on wake-from-sleep, and stream telemetry automatically.

### Managing the Remote Agent:
- **View Live Logs**:
  ```bash
  tail -f ~/.macai/agent/agent.log
  ```
- **Check Service Status**:
  ```bash
  launchctl list | grep com.macai.storage.agent
  ```
- **Uninstall / Stop Service**:
  ```bash
  # 1-Command Curl Uninstall (no git repo needed):
  curl -fsSL http://<coordinator-ip>:8000/uninstall | bash

  # Or manually unload from launchd:
  launchctl unload ~/Library/LaunchAgents/com.macai.storage.agent.plist
  rm -f ~/Library/LaunchAgents/com.macai.storage.agent.plist
  rm -rf ~/.macai/agent
  ```

---

## Demo & Simulation Scenarios

MacPulse includes built-in, safe workload simulators designed to reproduce real-world AI storage anomalies without modifying or endangering user files.

### Scenario 1: Safe Bounded Local I/O Spike
Simulates an AI model training checkpoint write burst (e.g. PyTorch / MLX saving weights):
```bash
make demo-load
# or: ./run.sh demo-load
```
1. Writes bounded 1MB chunks exclusively to `/tmp/macai_demo` with `fsync` flushing.
2. The agent detects write bandwidth jumping to ~80–150 MB/s.
3. The coordinator baseline engine compares the spike against the rolling 5-minute historical mean.
4. An **`abnormal_write` Warning/Critical Alert** fires in the dashboard.
5. Open the **Alert Drawer** and click **"Explain with Gemini"** to view telemetry-grounded root-cause analysis.

### Scenario 2: Simulated Parallel NFS (pNFS) Distributed Workload
Simulates multi-terabyte remote dataset streaming and NFS checkpoint synchronization:
```bash
make demo-nfs
# or: ./run.sh demo-nfs
```
1. Registers a 10TB simulated Parallel NFS mount (`/Volumes/ai_cluster_datasets`).
2. Generates realistic NFS RPC operations, read/write distributions, and network retransmission events.
3. Demonstrates how MacPulse correlates network file system latency and badcalls during distributed model training.

### Scenario 3: Investigating & Resolving Alerts
1. Click on any active alert in the **Recent Alerts** panel or **Alert Drawer**.
2. Click **"Explain with Gemini"**: The system constructs a sanitized telemetry payload and streams structured findings, including:
   - **Summary**: Concise description of what happened.
   - **Hypothesis**: Why the anomaly occurred based on observed metrics.
   - **Confidence Score**: Algorithmic certainty score.
   - **Actionable Checks**: Specific terminal commands and diagnostic steps for the administrator.
3. Click **"Resolve Alert"**, enter administrative resolution notes, and confirm. The alert status updates with an immutable audit timestamp.

### Scenario 4: Reset Demo State
To wipe all temporary test checkpoints and reset demo state:
```bash
make reset-demo
# or: ./run.sh reset-demo
```

---

## REST API Reference

The FastAPI coordinator exposes an OpenAPI-compliant REST API documented interactively at `http://localhost:8000/docs`.

### Core Health & Deployment Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Coordinator health check, database status, and system timestamp |
| `GET` | `/install` | Dynamic 1-line bash installation script for remote Macs |
| `GET` | `/uninstall` | Dynamic 1-line bash uninstallation script for remote Macs |
| `GET` | `/agent-bundle.tar.gz` | Lightweight in-memory tarball of the telemetry agent code |

### Ingestion & Agent Lifecycle Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/agents/register` | Register a new Mac host with hardware UUID, alias, OS, and cores |
| `POST` | `/api/v1/agents/{host_id}/heartbeat` | Periodic agent liveness ping (maintains online status) |
| `POST` | `/api/v1/ingest/metrics` | Ingest structured telemetry batch (mounts, I/O rates, SMART, system stats) |
| `POST` | `/api/v1/ingest/events` | Ingest active process attribution events (PID, process name, bytes, user) |

### Fleet Observability & Real-Time Streaming Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/overview` | Cluster-wide KPI rollup: total storage, active hosts, throughput, open alerts |
| `GET` | `/api/v1/stream/overview` | Server-Sent Events (SSE) live stream of fleet KPIs for dashboard clients |
| `GET` | `/api/v1/hosts` | List all registered Mac nodes with online/offline state and latest metrics |
| `GET` | `/api/v1/hosts/{host_id}` | Detailed host telemetry including NVMe SMART stats, memory pressure, and CPU load |
| `GET` | `/api/v1/hosts/{host_id}/metrics` | Time-series throughput and storage metrics for a specific host (`?minutes=15`) |
| `GET` | `/api/v1/volumes/detail` | Single volume detail with APFS container space accounting (`?volume_id={id}`) |
| `GET` | `/api/v1/volumes/detail/metrics` | Time-series metrics and sparkline history for a volume (`?volume_id={id}`) |

### Alerts & Root-Cause Analysis Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/alerts` | Query deduplicated alerts (filterable by status, severity, or host) |
| `GET` | `/api/v1/alerts/{alert_id}` | Retrieve alert details and audit history trail |
| `POST` | `/api/v1/alerts/{alert_id}/acknowledge` | Mark an alert as acknowledged by an operator |
| `POST` | `/api/v1/alerts/{alert_id}/resolve` | Resolve an alert with administrative notes and actor attribution |
| `POST` | `/api/v1/alerts/{alert_id}/explain` | Generate telemetry-grounded Gemini Explanation with fallback |

### Authentication & Access Control Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/me` | Returns authenticated user profile, email, name, and RBAC role (`Super Admin` / `Admin`) |
| `POST` | `/api/v1/auth/login` | Local / SSO user login with credentials; returns JWT session token |
| `POST` | `/api/v1/auth/signup` | Register new user account; returns JWT session token |
| `POST` | `/api/v1/admins` | Super Admin only: Invite new administrator (alias: `/api/v1/auth/create-admin`) |
| `GET` | `/api/v1/auth/invite-info` | Validate invite ticket and display invitation metadata (`?token=...`) |
| `POST` | `/api/v1/auth/accept-invite` | Accept administrator invitation, configure credentials, and activate account |

---

## Makefile & CLI Reference

Both `make` and `./run.sh` provide full command parity:

| Makefile Command | `./run.sh` Equivalent | Description |
|---|---|---|
| `make help` | `./run.sh help` | Display categorized command palette and usage guide |
| `make setup` | `./run.sh setup` | Create virtual environment and install backend + frontend dependencies |
| `make server` | `./run.sh server` | Launch central FastAPI coordinator on port 8000 |
| `make frontend` | `./run.sh frontend` | Launch Vite React development server on port 5173 |
| `make agent` | `./run.sh agent` | Start local macOS telemetry collector |
| `make install-agent` | `./run.sh install-agent` | Install native macOS `launchd` background service (auto-starts on boot) |
| `make uninstall-agent` | `./run.sh uninstall-agent`| Unload and remove native macOS `launchd` service |
| `make test` | `./run.sh test` | Run complete automated pytest test suite (25 test cases) |
| `make status` | `./run.sh status` | Check status of coordinator port 8000, launchd service, and active logs |
| `make lint` | `./run.sh lint` | Run frontend linter (`oxlint`) |
| `make demo-load` | `./run.sh demo-load` | Run safe bounded local I/O spike workload generator |
| `make demo-nfs` | `./run.sh demo-nfs` | Run simulated Parallel NFS (pNFS) distributed AI workload |
| `make demo-nfs-bg` | `./run.sh demo-nfs-bg` | Run simulated NFS workload in background (detached process) |
| `make stop-nfs` | `./run.sh stop-nfs` | Stop background simulated NFS workload |
| `make reset-demo` | `./run.sh reset-demo` | Clean temporary files and reset demo workload state |
| `make build` | `./run.sh build` | Compile optimized static bundle in `frontend/dist` |
| `make clean-cache` | `./run.sh clean-cache` | Remove `__pycache__`, `*.pyc`, and `.pytest_cache` directories |
| `make clean` | `./run.sh clean` | Deep clean: remove build artifacts, caches, and frontend dist |

---

## Automated Testing & Validation

MacPulse includes a comprehensive test suite with **25 automated tests** covering edge agent telemetry collectors, backend ingest & rule evaluation, Gemini Explain contracts, real-time SSE streaming, and Auth0 RBAC lifecycles:

```bash
# Run complete test suite:
make test
# or: ./run.sh test

# Or run individual test modules:
./.venv/bin/pytest tests/test_agent.py          # 6 tests
./.venv/bin/pytest tests/test_backend.py        # 9 tests
./.venv/bin/pytest tests/test_auth_and_alerts.py # 10 tests
```

### Test Suite Coverage Breakdown:

1. **Agent Telemetry Collectors (`tests/test_agent.py` — 6 tests)**:
   - **Hardware & Host Metadata**: Validates macOS platform detection, Darwin kernel release, core count, and hardware UUID generation.
   - **APFS/HFS Volume Discovery**: Verifies mount enumeration, synthetic filesystem exclusion (`devfs`, `autofs`), and capacity parsing.
   - **Delta I/O Sampler**: Tests read/write throughput calculations and delta rate smoothing math.
   - **UDP Auto-Discovery**: Verifies edge agent discovery ping transmission and coordinator response resolution on port 8765.
   - **Process Attribution**: Verifies active process sampling, PID mapping, and user attribution via `psutil`.
   - **NVMe / SMART Disk Health**: Validates SMART wear percentage, spare blocks, and thermal state collection.

2. **Backend Coordinator & Rule Engine (`tests/test_backend.py` — 9 tests)**:
   - **Coordinator Health & Lifecycle**: Verifies `/health` system status, timestamp, and database connectivity.
   - **Hardware UUID Registration & Heartbeats**: Tests agent node provisioning, online status maintenance, and heartbeat timeouts.
   - **Telemetry Ingestion & Capacity Alerts**: Verifies multi-volume ingestion, capacity threshold rule evaluation, and critical alert firing.
   - **Real-Time SSE Streaming**: Validates `/api/v1/stream/overview` Server-Sent Events output format and event serialization.
   - **Alert Deduplication**: Ensures repeated metric breaches increment occurrence counters instead of creating alert spam.
   - **System Compute & Thermal Rules**: Tests CPU pressure, memory swap usage, and thermal throttling alerts.
   - **NVMe Wear Degradation Rules**: Verifies SMART wear-leveling alerts and hardware degradation warnings.
   - **APFS Multi-Volume Accounting**: Validates container pool deduplication so shared APFS containers report accurate physical capacity.
   - **1-Line Remote Installer & Uninstaller**: Verifies `/install` and `/uninstall` self-contained bash script generation and LaunchAgent registration.

3. **Authentication, RBAC & Alert Lifecycle (`tests/test_auth_and_alerts.py` — 10 tests)**:
   - **Unauthenticated Route Protection**: Enforces 401 Unauthorized for requests lacking valid session tokens.
   - **Super Admin & Admin Profiles**: Validates `/api/v1/me` claims decoding, profile hydration, and role separation.
   - **Role-Based Access Control (RBAC)**: Enforces 403 Forbidden when standard Admins attempt Super Admin actions.
   - **Admin Invitation Workflow**: Generates unique one-time invitation setup tickets and validates payload requirements.
   - **Duplicate & Invalid Email Handling**: Validates regex email constraints and ensures duplicate registrations return 409 Conflict.
   - **Alert Operator Lifecycle**: Tests full alert acknowledgment (`/acknowledge`) with operator notes and resolution (`/resolve`) with audit timestamps.
   - **Login & Signup Request Validation**: Validates credential parsing, password constraints, and input sanitization.

