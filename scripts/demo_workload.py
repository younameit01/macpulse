#!/usr/bin/env python3
"""
Controlled safe I/O workload generator for MacAI Storage Observatory demo.
Simulates AI checkpointing and dataset file creation in a dedicated temporary directory.
Adheres strictly to PRD Section 4.3, 17.1 (AC-12), and 20.3:
- Bounded file size (never exhausts disk).
- Confined exclusively to MACAI_DEMO_DIR (/tmp/macai_demo).
- Does not modify or delete any user files.
"""

import os
import sys
import time
from pathlib import Path

DEMO_DIR = Path(os.getenv("MACAI_DEMO_DIR", "/tmp/macai_demo"))
DEMO_DIR.mkdir(parents=True, exist_ok=True)

CHUNK_SIZE = 1024 * 1024  # 1MB chunks
TARGET_TOTAL_MB = int(os.getenv("DEMO_TARGET_MB", "120"))  # 120MB bounded total

def run_load():
    print(f"[*] Starting MacAI safe controlled I/O workload...")
    print(f"[*] Target directory: {DEMO_DIR}")
    print(f"[*] Target volume payload: {TARGET_TOTAL_MB} MB")

    data = b"0" * CHUNK_SIZE
    file_path = DEMO_DIR / f"checkpoint_model_weights_{int(time.time())}.bin"

    print(f"[*] Writing to {file_path.name} to trigger abnormal write telemetry spike...")
    written = 0
    start = time.time()

    try:
        with open(file_path, "wb") as f:
            for i in range(TARGET_TOTAL_MB):
                f.write(data)
                f.flush()
                os.fsync(f.fileno())  # force actual disk commit for accurate I/O detection
                written += 1
                if written % 20 == 0:
                    elapsed = time.time() - start
                    rate = (written * 1024 * 1024) / max(0.1, elapsed) / (1024 * 1024)
                    print(f"    -> Progress: {written}/{TARGET_TOTAL_MB} MB ({rate:.1f} MB/s)")
                time.sleep(0.05)  # deliberate cadence simulating AI checkpoint write
    except KeyboardInterrupt:
        print("\n[!] Workload interrupted by user.")
    
    elapsed = time.time() - start
    rate = (written * 1024 * 1024) / max(0.1, elapsed) / (1024 * 1024)
    print(f"[+] Workload finished: {written} MB written in {elapsed:.2f}s (~{rate:.1f} MB/s).")
    print(f"[+] The MacAI Observatory dashboard will reflect this spike and trigger alert rules.")

if __name__ == "__main__":
    run_load()
