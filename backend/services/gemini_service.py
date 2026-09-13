import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from backend.config import GEMINI_API_KEY, GEMINI_MODEL
from backend.models import Alert

logger = logging.getLogger("gemini_service")

def sanitize_payload(alert: Alert, evidence: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize alert evidence according to PRD Section 8.3:
    Never include file contents, secrets, credentials, or raw unneeded logs.
    Only include host alias, filesystem type/mount, capacity, rates, thresholds, and process attribution.
    """
    sanitized = {
        "alert_type": alert.type,
        "severity": alert.severity,
        "opened_at": alert.opened_at.isoformat() if alert.opened_at else None,
        "last_seen_at": alert.last_seen_at.isoformat() if getattr(alert, "last_seen_at", None) else (alert.opened_at.isoformat() if alert.opened_at else None),
        "occurrence_count": getattr(alert, "occurrence_count", 1) or 1,
        "host_id": evidence.get("host_id", alert.host_id),
        "hostname": evidence.get("hostname", "Unknown Mac"),
        "volume_mount": evidence.get("volume_mount", "Unknown"),
        "fs_type": evidence.get("fs_type", "Unknown"),
        "rule": evidence.get("rule", ""),
        "message": evidence.get("message", ""),
    }

    # Capacity details
    if "used_pct" in evidence:
        sanitized["used_pct"] = evidence["used_pct"]
        sanitized["used_bytes"] = evidence.get("used_bytes")
        sanitized["total_bytes"] = evidence.get("total_bytes")
        sanitized["threshold_pct"] = evidence.get("threshold_pct")

    # Abnormal write details
    if "current_write_bps" in evidence:
        sanitized["current_write_bps"] = evidence["current_write_bps"]
        sanitized["baseline_write_bps"] = evidence.get("baseline_write_bps")
        sanitized["spike_multiplier"] = evidence.get("spike_multiplier")

    # NFS / pNFS protocol metrics
    if "nfs_retrans" in evidence:
        sanitized["nfs_retrans"] = evidence.get("nfs_retrans")
        sanitized["nfs_ops_per_sec"] = evidence.get("nfs_ops_per_sec")
        sanitized["server_export"] = evidence.get("server_export")
        sanitized["threshold_retrans"] = evidence.get("threshold_retrans")

    # Attribution details (strictly bounded to process name, pid, user)
    if "process_attribution" in evidence and isinstance(evidence["process_attribution"], dict):
        attr = evidence["process_attribution"]
        sanitized["process_attribution"] = {
            "process": attr.get("process", "Unavailable"),
            "pid": attr.get("pid"),
            "user": attr.get("user"),
            "confidence": attr.get("confidence", "Unavailable"),
        }

    # S.M.A.R.T. & Hardware health metrics
    if "disk_health" in evidence and isinstance(evidence["disk_health"], dict):
        dh = evidence["disk_health"]
        sanitized["hardware_health"] = {
            "smart_status": dh.get("smart_status"),
            "ssd_wear_pct": dh.get("ssd_wear_pct"),
            "temp_celsius": dh.get("temp_celsius"),
            "available_spare_pct": dh.get("available_spare_pct"),
            "media_errors": dh.get("media_errors", 0),
            "total_tb_written": dh.get("total_tb_written"),
            "bus_protocol": dh.get("bus_protocol"),
        }
    elif any(k in evidence for k in ("ssd_wear_pct", "temp_celsius", "smart_status", "media_errors")):
        sanitized["hardware_health"] = {
            "smart_status": evidence.get("smart_status"),
            "ssd_wear_pct": evidence.get("ssd_wear_pct"),
            "temp_celsius": evidence.get("temp_celsius"),
            "available_spare_pct": evidence.get("available_spare_pct"),
            "media_errors": evidence.get("media_errors", 0),
            "total_tb_written": evidence.get("total_tb_written"),
            "bus_protocol": evidence.get("bus_protocol"),
        }

    return sanitized


def build_prompt(sanitized: Dict[str, Any]) -> str:
    return f"""You are the root-cause analysis assistant for MacPulse, a macOS storage monitoring system for AI workloads.
Explain the following storage alert to a system administrator.

CRITICAL POLICY:
- Ground your explanation strictly on the provided telemetry facts.
- Do NOT fabricate or invent causes not supported by the data.
- If attribution is missing or labeled "Unavailable", explicitly state that the process/user could not be observed.
- Output ONLY valid JSON matching this exact structure:
{{
  "summary": "1-2 concise sentences stating what occurred and why the alert fired.",
  "evidence": ["Bullet 1 with measured numbers", "Bullet 2 with measured numbers"],
  "likely_interpretation": "A clearly labeled hypothesis explaining the behavior (use uncertainty phrasing if attribution is incomplete).",
  "recommended_checks": ["Safe check 1", "Safe check 2", "Safe check 3"],
  "risk": "Short description of the consequence if this storage condition continues."
}}

TELEMETRY DATA:
{json.dumps(sanitized, indent=2)}
"""


def generate_local_fallback(alert: Alert, evidence: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic local explanation when Gemini API is unavailable (PRD Section 8.5)"""
    hostname = evidence.get("hostname", "Monitored Mac")
    mount = evidence.get("volume_mount", "Storage Volume")
    rule = evidence.get("rule", "Configured threshold")

    if alert.type in ["capacity_warning", "capacity_critical"]:
        used_pct = evidence.get("used_pct", "unknown")
        used_gb = (evidence.get('used_bytes') or 0) // (1024*1024*1024)
        total_gb = (evidence.get('total_bytes') or 0) // (1024*1024*1024)
        return {
            "summary": f"Storage capacity alert on {hostname} for volume '{mount}' ({used_pct}% utilized).",
            "evidence": [
                f"Current utilization: {used_pct}% (Threshold rule: {rule})",
                f"Filesystem: {evidence.get('fs_type', 'local/APFS')}",
                f"Capacity: {used_gb}GB used of {total_gb}GB total"
            ],
            "likely_interpretation": "A local dataset, model checkpoint, or cache directory has accumulated substantial volume.",
            "recommended_checks": [
                f"Inspect largest directories under {mount} using 'du -sh * | sort -hr | head -n 10'.",
                "Verify if active AI training or inference checkpointing has unbounded retention.",
                "Review temporary cache folders and APFS local snapshots."
            ],
            "risk": "Risk of disk exhaustion, leading to filesystem write lockouts or aborted training jobs.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type == "abnormal_write":
        write_mb = round((evidence.get("current_write_bps") or 0) / (1024 * 1024), 1)
        base_mb = round((evidence.get("baseline_write_bps") or 0) / (1024 * 1024), 1)
        mult = evidence.get("spike_multiplier", "3+")
        proc_attr = evidence.get("process_attribution", {})
        proc_name = proc_attr.get("process", "Unknown")
        pid = proc_attr.get("pid")
        user = proc_attr.get("user")

        evidence_items = [
            f"Observed write rate: {write_mb} MB/s (Baseline: {base_mb} MB/s, {mult}x spike)",
            f"Target volume: {mount}",
            f"Attributed process: {proc_name} (PID: {pid or 'N/A'}, User: {user or 'N/A'})",
            f"Confidence: {proc_attr.get('confidence', 'Observed active write')}"
        ]
        return {
            "summary": f"Unusual write burst detected on {hostname}: {write_mb} MB/s ({mult}x baseline).",
            "evidence": evidence_items,
            "likely_interpretation": f"Process '{proc_name}' is writing at an abnormally elevated rate compared to recent rolling baseline.",
            "recommended_checks": [
                f"Inspect process '{proc_name}' activity using 'lsof -p {pid}' or Activity Monitor." if pid else "Review running I/O tasks.",
                "Verify if dataset export, large file copy, or runaway logging is occurring.",
                "Check whether disk write latency is elevating for concurrent workloads."
            ],
            "risk": "I/O saturation may degrade read/write response times for latency-sensitive applications.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type == "agent_offline":
        return {
            "summary": f"MacPulse storage agent on {hostname} is unresponsive.",
            "evidence": [
                f"No heartbeat reported for over {evidence.get('timeout_seconds', 15)}s",
                f"Host ID: {alert.host_id}",
                f"Last seen timestamp: {evidence.get('last_seen', 'unknown')}"
            ],
            "likely_interpretation": "The agent process was terminated, the Mac went to sleep, or a network partition occurred.",
            "recommended_checks": [
                f"Check if agent process is active on {hostname}.",
                "Verify network connectivity to coordinator.",
                "Review agent console output for connection refusal errors."
            ],
            "risk": "Loss of visibility into storage health and telemetry for this host.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type in ["ssd_wear_warning", "ssd_wear_critical"]:
        wear = evidence.get("ssd_wear_pct", "unknown")
        tb_w = evidence.get("total_tb_written", "N/A")
        spare = evidence.get("available_spare_pct", "N/A")
        return {
            "summary": f"SSD endurance wear alert on {hostname}: {wear}% lifetime endurance consumed.",
            "evidence": [
                f"SSD Wear Level: {wear}% used (Rule: {rule})",
                f"Reserve Spare Blocks Remaining: {spare}%",
                f"Cumulative Lifetime Written: {tb_w} TBW",
            ],
            "likely_interpretation": "Continuous high-volume AI checkpointing, swap paging, or dataset downloads have worn down the NAND flash endurance.",
            "recommended_checks": [
                "Plan hardware maintenance to rotate or replace this node's drive before spare block exhaustion.",
                "Offload intermediate model checkpoint dumps to shared network storage (NFS) to reduce local flash write amplification.",
                "Audit local swap memory pressure using 'vm_stat' and prune unneeded local caches."
            ],
            "risk": "Drive failure or read-only filesystem lockup once NAND flash endurance reaches 100%.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type in ["disk_overheating", "disk_temperature_warning"]:
        temp = evidence.get("temp_celsius", "unknown")
        return {
            "summary": f"Thermal pressure alert on {hostname}: NVMe flash controller temperature reached {temp}°C.",
            "evidence": [
                f"Measured Drive Temperature: {temp}°C (Rule: {rule})",
                f"Interconnect Protocol: {evidence.get('bus_protocol', 'Internal')}",
                f"Device Node: {evidence.get('device_node', '/')}",
            ],
            "likely_interpretation": "Heavy sustained I/O operations from AI workloads or high ambient temperature have triggered thermal throttling on the NVMe controller.",
            "recommended_checks": [
                f"Check node ventilation, fan curve, and ambient temperature around {hostname}.",
                "Inspect running processes with high I/O to determine if checkpointing or dataset loading can be rate-limited.",
                "Verify if the Mac is placed in a high-density cluster rack with insufficient airflow."
            ],
            "risk": "Controller thermal throttling will drastically reduce write/read speeds, causing severe pipeline latency.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type == "hardware_smart_failure":
        status_val = evidence.get("smart_status", "Failing")
        return {
            "summary": f"Hardware S.M.A.R.T. failure detected on {hostname}: Drive status reported as '{status_val}'.",
            "evidence": [
                f"Hardware S.M.A.R.T. Status: {status_val} (Rule: {rule})",
                f"Device: {evidence.get('device_node', '/')}",
                f"Bus: {evidence.get('bus_protocol', 'Internal')}",
            ],
            "likely_interpretation": "The internal storage hardware controller has signaled a critical self-monitoring failure.",
            "recommended_checks": [
                f"Immediately back up all unique local models, checkpoints, and weights on {hostname}.",
                "Run Apple Hardware Diagnostics (hold 'D' during boot) to verify drive controller integrity.",
                "Drain active AI workloads from this node and schedule immediate hardware replacement."
            ],
            "risk": "Imminent unrecoverable drive failure and total data loss.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type == "media_errors_detected":
        errors = evidence.get("media_errors", 1)
        return {
            "summary": f"Unrecoverable flash media errors detected on {hostname} ({errors} errors).",
            "evidence": [
                f"Flash Media Errors: {errors} (Rule: {rule})",
                f"Power-on Hours: {evidence.get('power_on_hours', 'N/A')}",
                f"Unsafe Shutdowns: {evidence.get('unsafe_shutdowns', 'N/A')}",
            ],
            "likely_interpretation": "The flash storage controller encountered bad blocks or uncorrectable ECC read/write failures.",
            "recommended_checks": [
                "Run 'diskutil verifyVolume /' to inspect APFS container consistency.",
                "Check system log ('log show --predicate \"eventMessage contains 'disk'\"') for I/O errors.",
                "Back up critical data and monitor for accelerating error counts."
            ],
            "risk": "Silent corruption of model weights, training checkpoints, or filesystem metadata.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type in ["memory_exhaustion_critical", "memory_pressure_warning"]:
        press_pct = evidence.get("pressure_pct", "N/A")
        press_status = evidence.get("pressure_status", "Elevated")
        swap_pct = evidence.get("swap_pct", 0)
        return {
            "summary": f"Memory pressure exhaustion on {hostname}: {press_pct}% memory pressure, {swap_pct}% swap used.",
            "evidence": [
                f"Memory Pressure: {press_pct}% (Status: {press_status}, Rule: {rule})",
                f"Swap Exhaustion: {swap_pct}% utilized",
                f"System Wired Memory: {round((evidence.get('wired_bytes') or 0) / (1024**3), 2)} GB",
            ],
            "likely_interpretation": "Host RAM is oversubscribed by memory-intensive processes (e.g. large LLM inference, training batch buffers, or leaks), forcing macOS compressor and heavy swap paging.",
            "recommended_checks": [
                f"Inspect top memory-consuming processes using 'top -o MEM' or Activity Monitor.",
                "Reduce batch sizes or context window length in running LLM / model runtimes.",
                "Verify if inactive memory is trapped in unreleased Python or PyTorch MPS tensor caches."
            ],
            "risk": "Thrashing between memory and SSD swap causes severe system stutter, high write wear, and potential process termination (OOM).",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type == "thermal_throttling_detected":
        therm_state = evidence.get("thermal_state", "Serious")
        return {
            "summary": f"Apple Silicon thermal throttling active on {hostname}: Thermal state is '{therm_state}'.",
            "evidence": [
                f"SoC Thermal State: {therm_state} (Rule: {rule})",
                f"Hardware Throttling Active: {evidence.get('is_throttled', True)}",
            ],
            "likely_interpretation": "Continuous high-utilization GPU/Neural Engine and CPU workloads have elevated SoC die temperature, causing macOS kernel to downclock frequencies.",
            "recommended_checks": [
                f"Verify chassis airflow, fan operation, and ambient temperature surrounding {hostname}.",
                "Check GPU and CPU utilization across concurrent pipelines.",
                "Temporarily throttle or pace AI model batch processing to allow cooling."
            ],
            "risk": "Compute throughput drops by 30-60% during thermal throttling, causing high inference latency and pipeline backlog.",
            "model": "local-fallback",
            "status": "fallback"
        }
    else:
        return {
            "summary": f"Alert '{alert.type}' triggered on {hostname}.",
            "evidence": [f"Triggered rule: {rule}", f"Severity: {alert.severity}"],
            "likely_interpretation": "Storage condition exceeded normal operating baseline.",
            "recommended_checks": ["Inspect storage dashboard and host logs."],
            "risk": "Potential performance degradation.",
            "model": "local-fallback",
            "status": "fallback"
        }


def explain_alert(alert: Alert) -> Dict[str, Any]:
    """
    Generate an explanation for an alert using Gemini API, with robust local fallback.
    """
    evidence = {}
    try:
        evidence = json.loads(alert.evidence_json)
    except Exception:
        evidence = {"raw": alert.evidence_json}

    sanitized = sanitize_payload(alert, evidence)

    api_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
    configured_model = os.getenv("GEMINI_MODEL", GEMINI_MODEL) or "gemini-3.5-flash-lite"

    if not api_key:
        logger.info("No GEMINI_API_KEY set; using deterministic local explanation.")
        return generate_local_fallback(alert, sanitized)

    # Models to attempt in order of preference (resilient to per-model 429 quota exhaustion)
    models_to_try = [configured_model, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"]
    seen = set()
    models_to_try = [m for m in models_to_try if m and not (m in seen or seen.add(m))]

    last_err = None
    for model_name in models_to_try:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = build_prompt(sanitized)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            
            response_text = response.text.strip()
            # Clean any markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            data = json.loads(response_text.strip())
            return {
                "summary": data.get("summary", ""),
                "evidence": data.get("evidence", []),
                "likely_interpretation": data.get("likely_interpretation", ""),
                "recommended_checks": data.get("recommended_checks", []),
                "risk": data.get("risk", ""),
                "model": model_name,
                "status": "success"
            }
        except Exception as e:
            last_err = e
            logger.warning(f"Gemini explain call failed for {model_name}: {e}")

    logger.warning(f"All Gemini models failed ({last_err}); falling back to deterministic explanation.")
    fallback = generate_local_fallback(alert, sanitized)
    fallback["status"] = "fallback"
    return fallback
