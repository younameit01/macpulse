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

    # Attribution details (strictly bounded to process name, pid, user)
    if "process_attribution" in evidence and isinstance(evidence["process_attribution"], dict):
        attr = evidence["process_attribution"]
        sanitized["process_attribution"] = {
            "process": attr.get("process", "Unavailable"),
            "pid": attr.get("pid"),
            "user": attr.get("user"),
            "confidence": attr.get("confidence", "Unavailable"),
        }

    return sanitized


def build_prompt(sanitized: Dict[str, Any]) -> str:
    return f"""You are the root-cause analysis assistant for MacAI Storage Observatory, a macOS storage monitoring system for AI workloads.
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
        return {
            "summary": f"Storage capacity alert on {hostname} for volume '{mount}' ({used_pct}% utilized).",
            "evidence": [
                f"Current utilization: {used_pct}% (Threshold rule: {rule})",
                f"Filesystem: {evidence.get('fs_type', 'local/APFS')}",
                f"Capacity: {evidence.get('used_bytes', 0) // (1024*1024*1024)}GB used of {evidence.get('total_bytes', 0) // (1024*1024*1024)}GB total"
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
        write_mb = round(evidence.get("current_write_bps", 0) / (1024 * 1024), 1)
        base_mb = round(evidence.get("baseline_write_bps", 0) / (1024 * 1024), 1)
        mult = evidence.get("spike_multiplier", "3+")
        attr = evidence.get("process_attribution", {})
        proc = attr.get("process", "Unavailable")

        return {
            "summary": f"Abnormal write spike detected on {hostname}: {write_mb} MB/s sustained throughput ({mult}x baseline).",
            "evidence": [
                f"Current write rate: {write_mb} MB/s vs baseline: {base_mb} MB/s",
                f"Target mount: {mount}",
                f"Attributed process: {proc} (Confidence: {attr.get('confidence', 'Unavailable')})"
            ],
            "likely_interpretation": f"A process ({proc}) is performing heavy batch writes, model weight downloads, or checkpoint exports.",
            "recommended_checks": [
                f"Check I/O activity on host {hostname} using 'iostat 1' or 'fs_usage -w -f filesys'.",
                f"Verify PID {attr.get('pid', 'N/A')} process hierarchy and user {attr.get('user', 'current user')}.",
                "Check whether write target is an NFS share causing network storage saturation."
            ],
            "risk": "Potential storage I/O bottleneck impacting other workloads on the shared filesystem.",
            "model": "local-fallback",
            "status": "fallback"
        }
    elif alert.type == "agent_offline":
        timeout = evidence.get("timeout_seconds", 9)
        return {
            "summary": f"Host {hostname} is no longer reporting heartbeats (offline for > {timeout} seconds).",
            "evidence": [
                f"Host ID: {alert.host_id}",
                f"Last seen timestamp: {evidence.get('last_seen')}",
                f"Rule: No heartbeat for {timeout}s (> 3 collection intervals)"
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
    model_name = os.getenv("GEMINI_MODEL", GEMINI_MODEL) or "gemini-3.6-flash"

    if not api_key:
        logger.info("No GEMINI_API_KEY set; using deterministic local explanation.")
        return generate_local_fallback(alert, sanitized)

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
            "model": GEMINI_MODEL,
            "status": "success"
        }
    except Exception as e:
        logger.warning(f"Gemini explain call failed: {e}; falling back to deterministic explanation.")
        fallback = generate_local_fallback(alert, sanitized)
        fallback["status"] = "fallback"
        return fallback
