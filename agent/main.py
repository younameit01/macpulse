import time
import sys
import signal
import logging
from datetime import datetime, timezone

from agent.config import (
    MACAI_COORDINATOR_URL,
    MACAI_AGENT_NAME,
    MACAI_SAMPLE_INTERVAL_SECONDS,
    MACAI_ENABLE_ELEVATED_COLLECTOR,
)
from agent.identity import get_host_metadata
from agent.client import CoordinatorClient
from agent.collectors.mounts import discover_mounts
from agent.collectors.io_stats import IOSampler
from agent.collectors.nfs_stats import collect_nfs_stats
from agent.collectors.process_usage import collect_active_processes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("macai.agent")

running = True

def handle_exit(signum, frame):
    global running
    logger.info("Termination signal received. Shutting down agent gracefully...")
    running = False

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

def run_agent():
    metadata = get_host_metadata()
    if MACAI_AGENT_NAME:
        metadata["hostname"] = MACAI_AGENT_NAME

    host_id = metadata["host_id"]
    logger.info(f"Starting MacAI Storage Agent for {metadata['hostname']} (ID: {host_id})")
    logger.info(f"Target coordinator: {MACAI_COORDINATOR_URL}")
    logger.info(f"Sampling interval: {MACAI_SAMPLE_INTERVAL_SECONDS}s | Elevated mode: {MACAI_ENABLE_ELEVATED_COLLECTOR}")

    client = CoordinatorClient(MACAI_COORDINATOR_URL)
    io_sampler = IOSampler()

    # Initial registration attempt
    client.register(metadata)

    registered = True
    iteration = 0

    while running:
        start_time = time.time()
        iteration += 1

        try:
            # 1. Heartbeat
            client.heartbeat(host_id)

            # 2. Discover mounts and measure capacity
            mounts = discover_mounts()

            # 3. Sample I/O throughput
            io_rates = io_sampler.sample()
            read_bps = io_rates["read_bps"]
            write_bps = io_rates["write_bps"]

            # 4. Sample NFS stats if any NFS mount present
            has_nfs = any(m.get("fs_type", "").lower() == "nfs" for m in mounts)
            nfs_info = collect_nfs_stats() if has_nfs else None

            # 5. Build samples
            samples = []
            if mounts:
                for m in mounts:
                    samples.append({
                        "volume_mount": m["mount_path"],
                        "used_bytes": m["used_bytes"],
                        "free_bytes": m["free_bytes"],
                        "read_bps": read_bps / len(mounts),
                        "write_bps": write_bps / len(mounts),
                        "nfs_ops_per_sec": nfs_info.get("requests") if nfs_info else None,
                        "nfs_retrans": nfs_info.get("retries") if nfs_info else None,
                    })
            else:
                samples.append({
                    "volume_mount": "/",
                    "used_bytes": 0,
                    "free_bytes": 0,
                    "read_bps": read_bps,
                    "write_bps": write_bps,
                })

            batch = {
                "host_id": host_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "volumes": mounts,
                "samples": samples,
            }

            client.send_metrics(batch)

            # 6. Sample process attribution if write rates are high or elevated mode active
            if write_bps > 5 * 1024 * 1024 or MACAI_ENABLE_ELEVATED_COLLECTOR:
                events = collect_active_processes(elevated=MACAI_ENABLE_ELEVATED_COLLECTOR)
                if events:
                    client.send_events({
                        "host_id": host_id,
                        "events": events,
                    })

            if iteration % 10 == 0:
                logger.info(f"Heartbeat ok. Monitored volumes: {len(mounts)}, Write: {write_bps / (1024*1024):.1f} MB/s, Read: {read_bps / (1024*1024):.1f} MB/s")

        except Exception as e:
            logger.warning(f"Error in agent collection cycle: {e}")

        # Sleep remaining time of interval
        elapsed = time.time() - start_time
        sleep_duration = max(0.1, MACAI_SAMPLE_INTERVAL_SECONDS - elapsed)
        time.sleep(sleep_duration)

    logger.info("MacAI agent stopped.")

if __name__ == "__main__":
    run_agent()
