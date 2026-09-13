#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$DIR/.venv/bin/python"
PLIST_LABEL="com.macai.storage.agent"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$LAUNCH_AGENTS_DIR/$PLIST_LABEL.plist"
LOG_DIR="$HOME/.macai"

echo "[*] Installing MacPulse background service (macOS launchd)..."

# 1. Verify virtual environment exists
if [ ! -f "$PYTHON" ]; then
    echo "[!] Virtual environment not found. Running setup first..."
    "$DIR/run.sh" setup
fi

# 2. Create log directory and LaunchAgents directory
mkdir -p "$LOG_DIR"
mkdir -p "$LAUNCH_AGENTS_DIR"

# 3. If already loaded, unload first
if launchctl list | grep -q "$PLIST_LABEL"; then
    echo "[*] Unloading existing service..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

# 4. Generate the macOS LaunchAgent plist
cat <<EOF > "$PLIST_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>-m</string>
        <string>agent.main</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/agent.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/agent.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

# 5. Load the service into macOS launchctl
launchctl load "$PLIST_FILE"

echo "[+] Successfully installed and started background service!"
echo "    • Plist Location : $PLIST_FILE"
echo "    • Status         : Active and set to auto-start on laptop boot / login"
echo "    • Logs           : $LOG_DIR/agent.log"
echo "    • To check logs  : tail -f $LOG_DIR/agent.log"
echo "    • To uninstall   : ./run.sh uninstall-agent"
