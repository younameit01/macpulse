import subprocess
import plistlib
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("macai.agent.smart")

def collect_disk_health(target_mount: str = "/") -> Dict[str, Any]:
    """
    Collect hardware S.M.A.R.T. and NVMe health telemetry using native macOS diskutil.
    No external dependencies or root privileges required.
    """
    try:
        cmd = ["diskutil", "info", "-plist", target_mount]
        out = subprocess.check_output(cmd, text=False, stderr=subprocess.DEVNULL)
        info = plistlib.loads(out)

        smart_dict = info.get("SMARTDeviceSpecificKeysMayVaryNotGuaranteed", {})

        # Temperature in diskutil is reported in Kelvin (e.g., 319K = ~46°C)
        temp_k = smart_dict.get("TEMPERATURE")
        temp_c = round(temp_k - 273.15, 1) if temp_k and temp_k > 200 else None

        # Data units written is reported in 512,000-byte units (NVMe spec standard)
        data_units_w = smart_dict.get("DATA_UNITS_WRITTEN_0", 0)
        total_tb_w = round((data_units_w * 512000) / (1024 ** 4), 2) if data_units_w else 0.0

        data_units_r = smart_dict.get("DATA_UNITS_READ_0", 0)
        total_tb_r = round((data_units_r * 512000) / (1024 ** 4), 2) if data_units_r else 0.0

        return {
            "smart_status": info.get("SMARTStatus", "Verified"),
            "ssd_wear_pct": smart_dict.get("PERCENTAGE_USED"),
            "temp_celsius": temp_c,
            "available_spare_pct": smart_dict.get("AVAILABLE_SPARE"),
            "available_spare_threshold_pct": smart_dict.get("AVAILABLE_SPARE_THRESHOLD"),
            "media_errors": smart_dict.get("MEDIA_ERRORS_0", 0),
            "total_tb_written": total_tb_w,
            "total_tb_read": total_tb_r,
            "power_on_hours": smart_dict.get("POWER_ON_HOURS_0"),
            "unsafe_shutdowns": smart_dict.get("UNSAFE_SHUTDOWNS_0"),
            "bus_protocol": info.get("BusProtocol", "Apple Fabric"),
            "is_solid_state": info.get("SolidState", True),
            "device_node": info.get("DeviceNode", ""),
            "volume_name": info.get("VolumeName", "Macintosh HD"),
        }
    except Exception as e:
        logger.debug(f"Failed to collect disk SMART health: {e}")
        return {
            "smart_status": "Unavailable",
            "ssd_wear_pct": None,
            "temp_celsius": None,
            "available_spare_pct": None,
            "available_spare_threshold_pct": None,
            "media_errors": 0,
            "total_tb_written": 0.0,
            "total_tb_read": 0.0,
            "power_on_hours": None,
            "unsafe_shutdowns": None,
            "bus_protocol": "Unknown",
            "is_solid_state": True,
            "device_node": "",
            "volume_name": "",
        }
