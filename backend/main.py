import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.routes import agents, ingest, overview, hosts, volumes, alerts, health, stream, installer

from backend.discovery import CoordinatorDiscoveryBeacon

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    beacon = CoordinatorDiscoveryBeacon(port=8000)
    beacon.start()
    yield
    beacon.stop()

app = FastAPI(
    title="MacAI Storage Observatory API",
    description="Coordinator for multi-Mac storage telemetry, alert engine, and Gemini Explain service",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins for trusted-LAN hackathon deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(installer.router)
app.include_router(health.router)
app.include_router(agents.router)
app.include_router(ingest.router)
app.include_router(overview.router)
app.include_router(hosts.router)
app.include_router(volumes.router)
app.include_router(alerts.router)
app.include_router(stream.router)

# If frontend is built, serve static files for single-process coordinator deployment
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
