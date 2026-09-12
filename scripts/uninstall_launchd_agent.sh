#!/usr/bin/env bash
set -e

PLIST_LABEL="com.macai.storage.agent"
PLIST_FILE="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

echo "[*] Uninstalling MacAI Storage Observatory background service..."

if [ -f "$PLIST_FILE" ]; then
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    rm -f "$PLIST_FILE"
    echo "[+] Unloaded and removed $PLIST_FILE"
else
    echo "[*] Service plist not found; nothing to remove."
fi

echo "[+] MacAI background agent successfully uninstalled."
