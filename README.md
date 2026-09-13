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
[![Tests](https://img.shields.io/badge/Pytest-23%20Passed-brightgreen?logo=pytest&logoColor=white)](#automated-testing--validation)
[![Zero-Git Deploy](https://img.shields.io/badge/Deployment-1--Line%20Curl%20Install-orange)](#remote-fleet-deployment-zero-git-1-line-install)

</div>

---

## Table of Contents

1. [Overview & Problem Statement](#overview--problem-statement)
2. [System Architecture](#system-architecture)
3. [Key Features](#key-features)
   - [Multi-Host Fleet Observability & Zero-Config Discovery](#1-multi-host-fleet-observability--zero-config-discovery)
   - [Zero-Git 1-Line Remote Deployment](#2-zero-git-1-line-remote-deployment)
   - [Native macOS Background Daemon (`launchd`)](#3-native-macos-background-daemon-launchd)
   - [Dual-Protocol Storage Telemetry (APFS & NFS/pNFS)](#4-dual-protocol-storage-telemetry-apfs--nfspnfs)
   - [Apple Silicon NVMe SMART Health & Unified Memory Pressure](#5-apple-silicon-nvme-smart-health--unified-memory-pressure)
   - [Kernel-Level Process Attribution (Who & What)](#6-kernel-level-process-attribution-who--what)
   - [Rolling Statistical Baselines & Anomaly Alert Engine](#7-rolling-statistical-baselines--anomaly-alert-engine)
   - [Telemetry-Grounded Gemini Explain Service](#8-telemetry-grounded-gemini-explain-service)
   - [Enterprise Auth0 & RBAC Management](#9-enterprise-auth0--rbac-management)
   - [Interactive 3D Hero Command Center](#10-interactive-3d-hero-command-center)
4. [Repository Layout](#repository-layout)
5. [Prerequisites & Environment Configuration](#prerequisites--environment-configuration)
6. [Quick Start Guide](#quick-start-guide)
7. [Remote Fleet Deployment (Zero-Git 1-Line Install)](#remote-fleet-deployment-zero-git-1-line-install)
8. [Demo & Simulation Scenarios](#demo--simulation-scenarios)
9. [REST API Reference](#rest-api-reference)
10. [Makefile & CLI Reference](#makefile--cli-reference)
11. [Automated Testing & Validation](#automated-testing--validation)
12. [HackWesTX 2026 Acceptance Checklist](#hackwestx-2026-acceptance-checklist)
13. [Security, Privacy & Data Governance](#security-privacy--data-governance)
14. [Troubleshooting & FAQ](#troubleshooting--faq)

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

```
                                  ┌────────────────────────────────────────┐
                                  │       React 19 Admin Dashboard         │
                                  │   ├── Three.js Dynamic WebGL Mesh      │
                                  │   ├── Fleet / Host / Volume Drawers    │
                                  │   ├── NVMe SMART & System Metrics      │
                                  │   └── Grounded Gemini Explain Drawer   │
                                  └───────────────────▲────────────────────┘
                                                      │ HTTP Polling (3s) / SSE Stream
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
                 │  • Mounts & Capacities: APFS Containers, HFS+, NFSv3/v4/pNFS Exports    │
                 │  • I/O Performance: Delta Throughput (read_bps, write_bps, IOPS)        │
                 │  • SMART Diagnostics: NVMe Wear %, Temp, Controller Health Status       │
                 │  • System Resources: Unified Memory Pressure, Core Load, Uptime         │
                 │  • Process Attribution: Elevated fs_usage trace & psutil fallback       │
                 │  • Network Storage: NFS RPC calls, timeouts, badcalls, retransmissions  │
                 └─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Multi-Host Fleet Observability & Zero-Config Discovery
- Automatically aggregates storage metrics across heterogeneous macOS machines into a single unified control plane.
- **Zero-Configuration UDP LAN Beacon**: The coordinator continuously broadcasts a secure UDP beacon on port `8001`. Client agents wake up, discover the coordinator's IP address on the local network automatically, and begin streaming telemetry without requiring hardcoded IP configurations.
- **Liveness Monitoring**: Tracks heartbeats on 3-second intervals; automatically flags nodes as `offline` if 3 consecutive heartbeats are missed.

### 2. Zero-Git 1-Line Remote Deployment
- Monitor secondary or tertiary Mac nodes on your Wi-Fi or LAN without installing Git, Node.js, or cloning the repository.
- A single `curl` command streams an in-memory, stripped tarball from `/agent-bundle.tar.gz`, builds an isolated Python runtime in `~/.macai/agent`, registers the service, and starts real-time telemetry streaming.

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

### 6. Kernel-Level Process Attribution (Who & What)
- Leverages macOS kernel tracing (`fs_usage`) when running in elevated mode (`make agent-elevated`), falling back seamlessly to `psutil` and `lsof` in standard mode.
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
- Native Auth0 integration supporting Role-Based Access Control (`Super Admin` vs. `Viewer`).
- Automated multi-admin invitations: Generates secure onboarding ticket links via Auth0 Management API.
- **Offline / Dev Fallback**: Fully functional offline development mode with simulated JWT authentication for air-gapped or testing environments.

### 10. Interactive 3D Hero Command Center
- Built with **Three.js (WebGL)**: An interactive 3D particle grid and wireframe network topology mesh dynamically reacts to real-time cluster storage throughput.
- Dark glassmorphism interface with SVG sparklines, tabbed machine views, granular hardware gauges, and slide-over investigation drawers.

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
│       └── process_usage.py          # Elevated fs_usage kernel tracing and psutil process attribution
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
│       ├── App.jsx                   # Central layout, state management, and polling coordinator
│       ├── api.js                    # Axios/Fetch API wrapper for coordinator endpoints
│       ├── alertUtils.js             # Client-side alert grouping and badge color helpers
│       ├── auth/                     # Auth0 context provider and login state hooks
│       └── components/               # Modular UI presentation components
│           ├── MacPulseBackground.jsx# Three.js 3D WebGL hero background animation
│           ├── Header.jsx            # Cluster status header, node switcher, and user avatar
│           ├── MachineTabs.jsx       # Tabbed navigation between fleet overview and individual Macs
│           ├── MachineOverviewCard.jsx # Host metadata, kernel version, and hardware badges
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
└── tests/                            # Automated Pytest Suite (23 Test Cases)
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
| `MACAI_AGENT_NAME` | String | `Mac-Primary` | Display alias for the local agent in the fleet dashboard |
| `MACAI_SAMPLE_INTERVAL_SECONDS` | Integer | `3` | Telemetry polling and transmission frequency in seconds |
| `MACAI_ENABLE_ELEVATED_COLLECTOR`| Boolean | `false` | When `true`, enables kernel-level `fs_usage` tracing (requires sudo) |
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
In a third terminal, start the local telemetry agent:
```bash
make agent
# or for full fs_usage process attribution: make agent-elevated
# or: ./run.sh agent
```
Within 3 seconds, your Mac will register and begin streaming real-time storage metrics to the dashboard!

---

## Remote Fleet Deployment (Zero-Git 1-Line Install)

To monitor additional Mac laptops or Mac Studios across your local network without cloning Git or installing Node.js/frontend dependencies:

On any other Mac on the same Wi-Fi or LAN, run:
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
  ./run.sh uninstall-agent
  # or: make uninstall-agent
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
| `GET` | `/agent-bundle.tar.gz` | Lightweight in-memory tarball of the telemetry agent code |

### Ingestion & Agent Lifecycle Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/agents/register` | Register a new Mac host with hardware UUID, alias, OS, and cores |
| `POST` | `/api/v1/agents/heartbeat` | Periodic agent liveness ping (maintains online status) |
| `POST` | `/api/v1/ingest/metrics` | Ingest structured telemetry batch (mounts, I/O rates, SMART, system stats) |

### Fleet Observability Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/overview` | Cluster-wide KPI rollup: total storage, active hosts, throughput, open alerts |
| `GET` | `/api/v1/hosts` | List all registered Mac nodes with online/offline state and latest metrics |
| `GET` | `/api/v1/hosts/{host_id}` | Detailed host telemetry including NVMe SMART stats, memory pressure, and CPU load |
| `GET` | `/api/v1/volumes` | List all discovered APFS and NFS volumes across the fleet |
| `GET` | `/api/v1/volumes/{volume_id}/history` | Retrieve time-series metric samples for interactive sparkline graphs |

### Alerts & Root-Cause Analysis Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/alerts` | Query deduplicated alerts (filterable by status, severity, or host) |
| `GET` | `/api/v1/alerts/{alert_id}` | Retrieve alert details and audit history trail |
| `POST` | `/api/v1/alerts/{alert_id}/acknowledge` | Mark an alert as acknowledged by an operator |
| `POST` | `/api/v1/alerts/{alert_id}/resolve` | Resolve an alert with administrative notes and actor attribution |
| `POST` | `/api/v1/alerts/{alert_id}/explain` | Generate telemetry-grounded Gemini Explanation with fallback |

### Authentication & Admin Management Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Local / SSO user login and session token generation |
| `POST` | `/api/v1/auth/create-admin` | Invite new administrator; generates secure setup ticket link |
| `GET` | `/api/v1/auth/admin-list` | List registered administrators and their roles (`Super Admin` / `Viewer`) |
| `DELETE`| `/api/v1/auth/admins/{id}` | Revoke administrator access |
| `GET` | `/api/v1/auth/invite-info` | Validate invite ticket and display invitation metadata |
| `POST` | `/api/v1/auth/accept-invite`| Accept administrator invitation and configure credentials |

---

## Makefile & CLI Reference

Both `make` and `./run.sh` provide full command parity:

| Makefile Command | `./run.sh` Equivalent | Description |
|---|---|---|
| `make help` | `./run.sh` | Display categorized command palette and usage guide |
| `make setup` | `./run.sh setup` | Create virtual environment and install backend + frontend dependencies |
| `make server` | `./run.sh server` | Launch central FastAPI coordinator on port 8000 |
| `make frontend` | `./run.sh frontend` | Launch Vite React development server on port 5173 |
| `make agent` | `./run.sh agent` | Start local macOS telemetry collector in standard mode |
| `make agent-elevated` | `./run.sh agent-elevated` | Start telemetry collector with sudo for kernel `fs_usage` attribution |
| `make install-agent` | `./run.sh install-agent` | Install native macOS `launchd` background service (auto-starts on boot) |
| `make uninstall-agent` | `./run.sh uninstall-agent`| Unload and remove native macOS `launchd` service |
| `make test` | `./run.sh test` | Run complete automated pytest test suite (23 test cases) |
| `make status` | `./run.sh status` | Check status of coordinator port 8000, launchd service, and active logs |
| `make lint` | `./run.sh lint` | Run frontend linter (`oxlint`) |
| `make demo-load` | `./run.sh demo-load` | Run safe bounded local I/O spike workload generator |
| `make demo-nfs` | `./run.sh demo-nfs` | Run simulated Parallel NFS (pNFS) distributed AI workload |
| `make reset-demo` | `./run.sh reset-demo` | Clean temporary files and reset demo workload state |
| `make build` | `./run.sh build` | Compile optimized static bundle in `frontend/dist` |
| `make clean-cache` | — | Remove `__pycache__`, `*.pyc`, and `.pytest_cache` directories |
| `make clean` | `./run.sh clean` | Deep clean: remove build artifacts, caches, and frontend dist |

---

## Automated Testing & Validation

MacPulse includes a comprehensive test suite with **23 automated tests** covering backend endpoints, agent collection, rule evaluation, auth workflows, and edge-case fallbacks:

```bash
make test
# or: ./run.sh test
```

### Test Suite Coverage Breakdown:
1. **Agent Telemetry Collectors (`tests/test_agent.py`)**:
   - macOS APFS/HFS mount discovery and capacity parsing.
   - I/O throughput rate calculation and delta sampler math.
   - Non-elevated fallback mechanisms when `fs_usage` is unavailable.
2. **Backend Coordinator & Rule Engine (`tests/test_backend.py`)**:
   - Coordinator health check and API lifecycle.
   - Agent registration and UUID hardware mapping.
   - Telemetry ingestion, capacity ratio calculations, and critical threshold alerts.
   - Gemini Explain contract enforcement and deterministic local fallback verification.
3. **Authentication & Alert Lifecycle (`tests/test_auth_and_alerts.py`)**:
   - Role-Based Access Control (RBAC) and admin user creation.
   - Invitation ticket generation and setup link verification.
   - Alert deduplication: ensures multiple metric spikes produce a single consolidated alert.
   - Manual alert resolution, administrative notes capture, and audit timestamping.

---

## HackWesTX 2026 Acceptance Checklist

MacPulse satisfies 100% of the P0 Acceptance Criteria defined in the competition specification:

| ID | Acceptance Criterion | Status | Verification & Evidence |
|---|---|---|---|
| **AC-01** | Two real Macs appear online simultaneously | **PASSED** | Hardware UUID registration, independent heartbeat loops, and UDP auto-discovery. |
| **AC-02** | APFS/local volume discovery with correct capacity | **PASSED** | `discover_mounts()` reads total, used, free bytes via macOS `statvfs` & `mount`. |
| **AC-03** | Team NFS mount detected as NFS | **PASSED** | Identifies `fs_type == "nfs"`, parses mount options, and tracks `nfsstat` RPC telemetry. |
| **AC-04** | Controlled I/O visibly changes throughput | **PASSED** | `demo_workload.py` generates measurable write spike reflected in `write_bps` within 3s. |
| **AC-05** | Metric samples visible in historical chart | **PASSED** | SQLite `metric_samples` persists time-series data; displayed via SVG sparklines. |
| **AC-06** | Abnormal-write or capacity rule produces alert | **PASSED** | Dynamic baseline engine compares against 5-min mean and triggers `abnormal_write` alert. |
| **AC-07** | Process attribution evidence | **PASSED** | Elevated `fs_usage` and fallback `psutil` collectors attribute PID, process, and user. |
| **AC-08** | Gemini Explain returns telemetry-grounded explanation | **PASSED** | Formulates hypotheses and actionable checks strictly from measured telemetry. |
| **AC-09** | Stopping agent marks host offline after timeout | **PASSED** | Heartbeat liveness monitor flags node offline after 3 missed sample intervals (9s). |
| **AC-10** | Gemini absence/outage does not crash monitoring | **PASSED** | Deterministic local fallback provides structured analysis without external API dependencies. |
| **AC-11** | Reproducible setup via scripts / Makefile | **PASSED** | Fully verified 1-command `./run.sh setup` and `make setup` workflows. |
| **AC-12** | Demo scripts do not write outside demo directory | **PASSED** | `demo_workload.py` bounded strictly to `/tmp/macai_demo` with zero user file interaction. |

---

## Security, Privacy & Data Governance

Adheres strictly to the PRD Section 15 Security & Privacy Specification:

1. **Zero Data Exfiltration Policy**:
   - MacPulse **never** inspects, reads, or transmits document contents, source code, dataset records, or neural network weights.
   - Only non-sensitive numerical telemetry (bytes written, read operations/sec, mount paths, process names) is ingested.
2. **Sanitized Gemini Payloads**:
   - The Gemini Explain service receives strictly structured JSON payloads containing anonymized hardware aliases, volume paths, rate deltas, and process names. No personal identifiable information (PII) or user directories are included.
3. **Read-Only / Early-Warning Architecture**:
   - MacPulse is strictly an observability and diagnostic system. It does not possess permissions to kill processes, unmount filesystems, or delete user files.
4. **Local Network Isolation**:
   - All coordinator communication operates over your local LAN / Wi-Fi network without requiring third-party cloud brokers or external relay servers.

---

## Troubleshooting & FAQ

### 1. Port 8000 is already in use
If another service is using port 8000:
```bash
# Check what is running on port 8000
lsof -i :8000

# Run coordinator on an alternate port:
PORT=8080 make server
# or: PORT=8080 ./run.sh server
```

### 2. Xcode License Agreement Prompt when running `make`
If your Mac displays `You have not agreed to the Xcode license agreements`:
- **Option A**: Run `sudo xcodebuild -license accept` in your terminal.
- **Option B**: Use the Command Line Tools `make` directly:
  ```bash
  /Library/Developer/CommandLineTools/usr/bin/make [target]
  ```
- **Option C**: Use `./run.sh [target]`, which does not depend on Xcode developer licenses!

### 3. Remote Mac cannot reach Coordinator
- Confirm both Macs are connected to the same local Wi-Fi / LAN subnet.
- Check macOS firewall: `System Settings -> Network -> Firewall` and ensure Python / incoming connections are permitted.
- Test network connectivity from the remote Mac:
  ```bash
  curl -I http://<coordinator-ip>:8000/health
  ```

### 4. Enabling Elevated Process Attribution (`fs_usage`)
To allow MacPulse to attribute disk I/O to specific system processes with zero guesswork:
```bash
make agent-elevated
# or: ./run.sh agent-elevated
```
This runs the agent with `sudo`, enabling read-only kernel tracing via macOS `fs_usage`.

### 5. Inspecting the SQLite Database
To inspect stored telemetry samples and alerts directly:
```bash
sqlite3 macai_observatory.db "SELECT host_id, fs_type, mount_path, percent_used FROM volumes;"
sqlite3 macai_observatory.db "SELECT id, alert_type, severity, status, opened_at FROM alerts;"
```

---

<div align="center">

**Built with pride for TTU HackWesTX 2026**  
*Empowering engineers with high-fidelity macOS storage observability.*

</div>
