#!/usr/bin/env python3
"""
Simulated NFS/pNFS Network Storage Workload for MacPulse.
Emits synthetic Parallel NFS telemetry, RPC operations/sec, and network retransmissions
to test the dashboard, alert engine, and Gemini Explain without requiring root/sudo privileges.

Usage:
    python scripts/demo_nfs_workload.py
    python scripts/demo_nfs_workload.py --clean
"""

import sys
import time
import argparse
import requests
from datetime import datetime, timezone
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from agent.identity import get_host_metadata
from agent.discovery import discover_coordinator_url

NFS_MOUNT_PATH = "/Volumes/ai_cluster_datasets"
NFS_SOURCE = "10.161.3.95:/exports/pnfs_models"
TOTAL_BYTES = 10 * 1024 * 1024 * 1024 * 1024  # 10 TB
USED_BYTES = 6 * 1024 * 1024 * 1024 * 1024   # 6 TB (60% capacity)

def run_nfs_demo():
    print("=" * 70)
    print("  MacPulse — Simulated NFS/pNFS Workload")
    print("=" * 70)

    # 1. Host identity and coordinator discovery
    metadata = get_host_metadata()
    host_id = metadata["host_id"]
    hostname = metadata["hostname"]
    coordinator_url = discover_coordinator_url()

    print(f"[*] Host: {hostname} ({host_id[:8]}...)")
    print(f"[*] Coordinator: {coordinator_url}")
    print(f"[*] Simulated Mount: {NFS_MOUNT_PATH} (pNFS / NFSv4.1)")
    print(f"[*] Remote Storage Export: {NFS_SOURCE}")
    print("-" * 70)

    # Check coordinator health
    try:
        r = requests.get(f"{coordinator_url}/health", timeout=3)
        if r.status_code != 200:
            print(f"[!] Coordinator returned status {r.status_code}. Is it running?")
            sys.exit(1)
    except Exception as e:
        print(f"[!] Cannot reach coordinator at {coordinator_url}: {e}")
        print("    Please run './run.sh server' first.")
        sys.exit(1)

    volume_def = {
        "source": NFS_SOURCE,
        "mount_path": NFS_MOUNT_PATH,
        "fs_type": "nfs",
        "total_bytes": TOTAL_BYTES,
        "used_bytes": USED_BYTES,
        "free_bytes": TOTAL_BYTES - USED_BYTES,
    }

    def send_metrics(read_bps, write_bps, ops_per_sec, retrans, stage_name):
        now = datetime.now(timezone.utc).isoformat()
        sample = {
            "volume_mount": NFS_MOUNT_PATH,
            "used_bytes": USED_BYTES,
            "free_bytes": TOTAL_BYTES - USED_BYTES,
            "read_bps": read_bps,
            "write_bps": write_bps,
            "nfs_ops_per_sec": ops_per_sec,
            "nfs_retrans": retrans,
        }
        payload = {
            "host_id": host_id,
            "timestamp": now,
            "volumes": [volume_def],
            "samples": [sample],
        }
        resp = requests.post(f"{coordinator_url}/api/v1/ingest/metrics", json=payload, timeout=3)
        print(f"  [{stage_name}] R: {read_bps/(1024*1024):.1f} MB/s | W: {write_bps/(1024*1024):.1f} MB/s | "
              f"RPC Ops: {ops_per_sec:.0f}/s | Retrans: {retrans}")

    def send_process_event(process_name, pid, user, op, bytes_count):
        payload = {
            "host_id": host_id,
            "events": [{
                "process": process_name,
                "pid": pid,
                "user": user,
                "operation": op,
                "bytes": bytes_count,
                "volume_mount": NFS_MOUNT_PATH,
            }]
        }
        requests.post(f"{coordinator_url}/api/v1/ingest/events", json=payload, timeout=3)

    try:
        # -------------------------------------------------------------
        # Phase 1: Normal pNFS High-Throughput Dataset Streaming
        # -------------------------------------------------------------
        print("\n[Phase 1/3] Simulating healthy Parallel NFS dataset streaming (5 cycles)...")
        print("    -> Check Dashboard: Watch for purple 'NFS' badge on the volume.")
        for i in range(5):
            send_metrics(
                read_bps=75.0 * 1024 * 1024,   # 75 MB/s
                write_bps=12.0 * 1024 * 1024,  # 12 MB/s
                ops_per_sec=580.0,
                retrans=0,
                stage_name=f"HEALTHY {i+1}/5"
            )
            time.sleep(2)

        # -------------------------------------------------------------
        # Phase 2: Network Congestion & Retransmission Spike
        # -------------------------------------------------------------
        print("\n[Phase 2/3] Simulating Network Latency & RPC Retransmission Spike (5 cycles)...")
        print("    -> Check Dashboard: Watch for 'nfs_retrans_high' alert in the alert bell / drawer!")
        print("    -> You can click 'Explain with Gemini' on the alert to see root-cause diagnostics.")
        
        # Attribution for AI training checkpoint
        send_process_event("python3", 84210, "younameit01", "write", 450 * 1024 * 1024)

        retrans_counts = [6, 11, 19, 22, 16]
        for idx, r_count in enumerate(retrans_counts):
            send_metrics(
                read_bps=14.0 * 1024 * 1024,
                write_bps=38.0 * 1024 * 1024,  # 38 MB/s checkpoint write
                ops_per_sec=140.0,             # dropped throughput due to retries
                retrans=r_count,
                stage_name=f"CONGESTION {idx+1}/5"
            )
            time.sleep(2)

        # -------------------------------------------------------------
        # Phase 3: Recovery
        # -------------------------------------------------------------
        print("\n[Phase 3/3] Simulating Network Recovery (3 cycles)...")
        print("    -> Check Dashboard: Retransmissions drop to 0, alert auto-resolves.")
        for i in range(3):
            send_metrics(
                read_bps=50.0 * 1024 * 1024,
                write_bps=8.0 * 1024 * 1024,
                ops_per_sec=420.0,
                retrans=0,
                stage_name=f"RECOVERED {i+1}/3"
            )
            time.sleep(2)

        print("\n" + "=" * 70)
        print("[+] NFS/pNFS Simulation Completed Successfully!")
        print(f"[*] Open your browser to view the results:")
        print(f"    - Coordinator Dashboard: http://localhost:8000")
        print(f"    - On other laptop:        {coordinator_url}")
        print(f"[*] Inspect Volume: Click on '{NFS_MOUNT_PATH}' to inspect RPC Ops and Retrans metrics.")
        print(f"[*] Clean up demo data anytime: python scripts/demo_nfs_workload.py --clean")
        print("=" * 70)

    except KeyboardInterrupt:
        print("\n[!] Simulation halted by user.")

def clean_nfs_demo():
    print("[*] Cleaning simulated NFS demo volume and associated alerts from database...")
    from backend.database import SessionLocal
    from backend.models import Volume, MetricSample, Alert, ProcessEvent

    db = SessionLocal()
    try:
        vols = db.query(Volume).filter(Volume.mount_path == NFS_MOUNT_PATH).all()
        for v in vols:
            db.query(MetricSample).filter(MetricSample.volume_id == v.id).delete()
            db.query(Alert).filter(Alert.volume_id == v.id).delete()
            db.query(ProcessEvent).filter(ProcessEvent.volume_id == v.id).delete()
            db.delete(v)
        db.commit()
        print(f"[+] Successfully removed simulated volume '{NFS_MOUNT_PATH}' and its metrics/alerts.")
    except Exception as e:
        db.rollback()
        print(f"[!] Error during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulate NFS / pNFS telemetry workload")
    parser.add_argument("--clean", action="store_true", help="Remove simulated NFS volume and alerts from the database")
    args = parser.parse_args()

    if args.clean:
        clean_nfs_demo()
    else:
        run_nfs_demo()
