#!/usr/bin/env python3
"""
Reset script for MacAI Storage Observatory.
Removes only application/demo-generated data and temporary files.
"""

import os
import shutil
from pathlib import Path

DEMO_DIR = Path(os.getenv("MACAI_DEMO_DIR", "/tmp/macai_demo"))
project_root = Path(__file__).resolve().parent.parent
db_path = project_root / "macai_observatory.db"

def reset():
    print("[*] Resetting MacAI Storage Observatory demo state...")

    # 1. Clean demo folder
    if DEMO_DIR.exists():
        for item in DEMO_DIR.iterdir():
            if item.is_file():
                item.unlink()
                print(f"    Removed demo file: {item.name}")
        print(f"[+] Cleaned demo directory: {DEMO_DIR}")

    # 2. Reset database if requested
    reset_db = os.getenv("RESET_DB", "false").lower() in ("true", "1", "yes")
    if reset_db and db_path.exists():
        db_path.unlink()
        print(f"[+] Removed SQLite database: {db_path}")

    print("[+] Demo environment successfully reset.")

if __name__ == "__main__":
    reset()
