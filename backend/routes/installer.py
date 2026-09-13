import tarfile
import io
from pathlib import Path
from fastapi import APIRouter, Response, Request
from fastapi.responses import PlainTextResponse, StreamingResponse

router = APIRouter(tags=["installer"])

@router.get("/install", response_class=PlainTextResponse)
def get_install_script(request: Request):
    """
    Returns a self-contained 1-line installation bash script for remote Macs.
    Usage on any Mac: curl -fsSL http://<coordinator-ip>:8000/install | bash
    """
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
    host_header = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost:8000")
    coordinator_url = f"{proto}://{host_header}"

    script = f"""#!/usr/bin/env bash
set -e

COORDINATOR_URL="{coordinator_url}"
INSTALL_DIR="$HOME/.macai/agent"
PLIST_LABEL="com.macai.storage.agent"
PLIST_FILE="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

echo "=================================================="
echo " MacPulse - Remote Agent Setup                    "
echo "=================================================="
echo "[*] Coordinator: $COORDINATOR_URL"
echo "[*] Destination: $INSTALL_DIR"

# 1. Prepare directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/Library/LaunchAgents"

# 2. Download lightweight agent bundle
echo "[*] Downloading telemetry agent bundle..."
curl -fsSL "$COORDINATOR_URL/agent-bundle.tar.gz" | tar -xz -C "$INSTALL_DIR"

# 3. Setup lightweight Python environment (psutil + httpx only)
echo "[*] Setting up isolated Python environment..."
python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/.venv/bin/pip" install --quiet psutil httpx python-dotenv

# 4. Unload existing service if present
if launchctl list | grep -q "$PLIST_LABEL"; then
    echo "[*] Updating existing background service..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

# 5. Generate macOS LaunchAgent plist
cat <<EOF > "$PLIST_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/.venv/bin/python</string>
        <string>-m</string>
        <string>agent.main</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/agent.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/agent.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>MACAI_COORDINATOR_URL</key>
        <string>$COORDINATOR_URL</string>
    </dict>
</dict>
</plist>
EOF

# 6. Load background service into launchctl
launchctl load "$PLIST_FILE"

echo ""
echo "[+] SUCCESS! MacAI background telemetry agent is installed and running!"
echo "    • Auto-starts automatically on Mac boot and wake-from-sleep"
echo "    • Telemetry streaming to: $COORDINATOR_URL"
echo "    • View live logs: tail -f $INSTALL_DIR/agent.log"
echo "=================================================="
"""
    return script


@router.get("/uninstall", response_class=PlainTextResponse)
def get_uninstall_script():
    """
    Returns a self-contained 1-line uninstallation bash script for remote Macs.
    Usage on any Mac: curl -fsSL http://<coordinator-ip>:8000/uninstall | bash
    """
    script = """#!/usr/bin/env bash
set -e

PLIST_LABEL="com.macai.storage.agent"
PLIST_FILE="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
INSTALL_DIR="$HOME/.macai/agent"

echo "=================================================="
echo " MacPulse - Remote Agent Uninstallation           "
echo "=================================================="

# 1. Unload and delete launchd background service
if [ -f "$PLIST_FILE" ]; then
    echo "[*] Unloading and removing macOS launchd service..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    rm -f "$PLIST_FILE"
    echo "[+] Removed $PLIST_FILE"
else
    echo "[*] launchd service plist not found (already removed)."
fi

# 2. Clean up installed agent files and virtual environment
if [ -d "$INSTALL_DIR" ]; then
    echo "[*] Cleaning up isolated agent runtime at $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    echo "[+] Removed $INSTALL_DIR"
fi

echo ""
echo "[+] SUCCESS! MacPulse telemetry agent completely removed."
echo "=================================================="
"""
    return script


@router.get("/agent-bundle.tar.gz")
def get_agent_bundle():
    """
    Packs only the agent/ directory into an in-memory tarball for lightweight download.
    Does NOT include frontend, node_modules, tests, or database files.
    """
    root_dir = Path(__file__).resolve().parent.parent.parent
    agent_dir = root_dir / "agent"
    if not agent_dir.exists():
        agent_dir = Path("/app/agent")
    if not agent_dir.exists():
        agent_dir = Path("agent")
    if not agent_dir.exists():
        raise RuntimeError(f"Agent directory not found at candidate paths: {root_dir}/agent, /app/agent")

    tar_bytes = io.BytesIO()
    with tarfile.open(fileobj=tar_bytes, mode="w:gz") as tar:
        # Add agent folder contents
        tar.add(str(agent_dir), arcname="agent")

    tar_bytes.seek(0)
    return Response(
        content=tar_bytes.read(),
        media_type="application/gzip",
        headers={"Content-Disposition": "attachment; filename=agent-bundle.tar.gz"},
    )
