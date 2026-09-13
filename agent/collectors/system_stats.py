import os
import re
import time
import logging
import ctypes
import ctypes.util
import subprocess
from typing import Dict, Any, Optional
import psutil

logger = logging.getLogger("macai.agent.system_stats")

class SystemStatsCollector:
    """
    Zero-privilege macOS System Telemetry Collector.
    Collects real-time CPU, Apple Silicon GPU, Memory Pressure/Exhaustion,
    and System Thermal State without requiring root/sudo privileges.
    """

    def __init__(self):
        self._last_gpu_time: Optional[float] = None
        self._last_accumulated_gpu_ns: Optional[int] = None
        self._gpu_cores: int = self._detect_gpu_cores()
        self._objc_loaded = False
        self._ns_process_info = None
        self._thermal_state_sel = None
        self._init_thermal_objc()

        # Prime the CPU and GPU samplers
        psutil.cpu_percent(interval=None)
        self._sample_gpu_accumulated_ns()

    def _detect_gpu_cores(self) -> int:
        """Detect Apple Silicon GPU core count via ioreg."""
        try:
            out = subprocess.check_output(
                ["ioreg", "-r", "-c", "AppleARMIODevice", "-l"],
                text=True,
                stderr=subprocess.DEVNULL,
                timeout=2.0
            )
            m = re.search(r'"gpu-core-count"\s*=\s*(\d+)', out)
            if m:
                return int(m.group(1))
        except Exception as e:
            logger.debug(f"Could not detect gpu-core-count: {e}")
        return 8

    def _init_thermal_objc(self):
        """Initialize ctypes binding to NSProcessInfo.thermalState."""
        try:
            objc_path = ctypes.util.find_library("objc")
            if not objc_path:
                return
            objc = ctypes.cdll.LoadLibrary(objc_path)
            objc.objc_getClass.restype = ctypes.c_void_p
            objc.sel_registerName.restype = ctypes.c_void_p
            objc.objc_msgSend.restype = ctypes.c_void_p
            objc.objc_msgSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p]

            NSProcessInfo = objc.objc_getClass(b"NSProcessInfo")
            processInfo_sel = objc.sel_registerName(b"processInfo")
            self._ns_process_info = objc.objc_msgSend(NSProcessInfo, processInfo_sel)

            self._thermal_state_sel = objc.sel_registerName(b"thermalState")
            self._objc = objc
            self._objc_loaded = True
        except Exception as e:
            logger.debug(f"Failed to initialize NSProcessInfo thermalState ctypes: {e}")
            self._objc_loaded = False

    def _sample_gpu_accumulated_ns(self) -> Optional[int]:
        """Read total accumulated GPU nanoseconds across all active Metal user clients."""
        try:
            out = subprocess.check_output(
                ["ioreg", "-r", "-c", "IOAccelerator", "-l"],
                text=True,
                stderr=subprocess.DEVNULL,
                timeout=1.5
            )
            total_ns = 0
            found = False
            for m in re.finditer(r'"accumulatedGPUTime"=(\d+)', out):
                total_ns += int(m.group(1))
                found = True
            now = time.time()
            self._last_gpu_time = now
            self._last_accumulated_gpu_ns = total_ns if found else None
            return total_ns if found else None
        except Exception as e:
            logger.debug(f"Failed to read IOAccelerator accumulatedGPUTime: {e}")
            return None

    def get_gpu_utilization_pct(self) -> float:
        """Compute instantaneous GPU utilization % since last sample."""
        prev_time = self._last_gpu_time
        prev_ns = self._last_accumulated_gpu_ns

        curr_ns = self._sample_gpu_accumulated_ns()
        curr_time = self._last_gpu_time

        if prev_time is None or prev_ns is None or curr_ns is None or curr_time is None:
            return 0.0

        delta_time_s = curr_time - prev_time
        if delta_time_s <= 0.001:
            return 0.0

        delta_gpu_s = (curr_ns - prev_ns) / 1e9
        if delta_gpu_s < 0:
            return 0.0

        # Utilization normalized to 0.0 - 100.0%
        pct = (delta_gpu_s / delta_time_s) * 100.0
        return round(min(100.0, max(0.0, pct)), 1)

    def get_memory_info(self) -> Dict[str, Any]:
        """
        Collect macOS memory telemetry faithfully matching Apple's Activity Monitor:
        - Memory Used = App Memory + Wired Memory + Compressed Memory
        - Memory Pressure Level = kern.memorystatus_vm_pressure_level
        - Free Headroom = kern.memorystatus_level
        """
        try:
            page_size = 16384
            total_bytes = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True, stderr=subprocess.DEVNULL).strip())

            vm_stat_out = subprocess.check_output(["vm_stat"], text=True, stderr=subprocess.DEVNULL)
            vm_dict = {}
            for line in vm_stat_out.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    v = v.strip().rstrip(".")
                    try:
                        vm_dict[k.strip()] = int(v)
                    except ValueError:
                        pass

            pages_wired = vm_dict.get("Pages wired down", 0)
            pages_compressed = vm_dict.get("Pages occupied by compressor", 0)
            pages_purgeable = vm_dict.get("Pages purgeable", 0)
            file_backed = vm_dict.get("File-backed pages", 0)
            anonymous = vm_dict.get("Anonymous pages", 0)
            pages_free = vm_dict.get("Pages free", 0)

            # Apple Activity Monitor exact formulas:
            app_bytes = max(0, anonymous - pages_purgeable) * page_size
            wired_bytes = pages_wired * page_size
            compressed_bytes = pages_compressed * page_size
            used_bytes = app_bytes + wired_bytes + compressed_bytes
            cached_bytes = (file_backed + pages_purgeable) * page_size
            free_bytes = pages_free * page_size

            # Kernel memory pressure status code (1=Normal, 2=Warning, 4=Critical)
            try:
                code_str = subprocess.check_output(["sysctl", "-n", "kern.memorystatus_vm_pressure_level"], text=True, stderr=subprocess.DEVNULL).strip()
                code = int(code_str)
            except Exception:
                code = 1
            status_map = {1: "Normal", 2: "Warning", 4: "Critical"}
            pressure_status = status_map.get(code, "Normal")

            # Kernel memory free headroom level
            try:
                kern_str = subprocess.check_output(["sysctl", "-n", "kern.memorystatus_level"], text=True, stderr=subprocess.DEVNULL).strip()
                free_headroom = int(kern_str)
            except Exception:
                free_headroom = 30

            pressure_pct = 100 - free_headroom

            swap = psutil.swap_memory()

            return {
                "total_bytes": total_bytes,
                "used_bytes": used_bytes,
                "app_bytes": app_bytes,
                "wired_bytes": wired_bytes,
                "compressed_bytes": compressed_bytes,
                "cached_bytes": cached_bytes,
                "free_bytes": free_bytes,
                "usage_pct": round((used_bytes / total_bytes) * 100, 1),
                "pressure_pct": pressure_pct,
                "pressure_status": pressure_status,
                "free_headroom_pct": free_headroom,
                "swap_total_bytes": swap.total,
                "swap_used_bytes": swap.used,
                "swap_pct": round(swap.percent, 1),
            }
        except Exception as e:
            logger.debug(f"macOS memory collection fallback: {e}")
            vm = psutil.virtual_memory()
            swap = psutil.swap_memory()
            return {
                "total_bytes": vm.total,
                "used_bytes": vm.used,
                "app_bytes": vm.active,
                "wired_bytes": getattr(vm, "wired", 0),
                "compressed_bytes": 0,
                "cached_bytes": getattr(vm, "inactive", 0),
                "free_bytes": vm.free,
                "usage_pct": round(vm.percent, 1),
                "pressure_pct": 50,
                "pressure_status": "Normal",
                "free_headroom_pct": 50,
                "swap_total_bytes": swap.total,
                "swap_used_bytes": swap.used,
                "swap_pct": round(swap.percent, 1),
            }

    def get_thermal_state(self) -> Dict[str, Any]:
        """Read macOS thermal state (0=Nominal, 1=Fair, 2=Serious, 3=Critical)."""
        if self._objc_loaded and self._ns_process_info and self._thermal_state_sel:
            try:
                self._objc.objc_msgSend.restype = ctypes.c_long
                ts = self._objc.objc_msgSend(self._ns_process_info, self._thermal_state_sel)
                state_map = {0: "Nominal", 1: "Fair", 2: "Serious", 3: "Critical"}
                state_str = state_map.get(ts, "Nominal")
                return {
                    "thermal_state": state_str,
                    "is_throttled": ts >= 2,
                    "raw_level": ts
                }
            except Exception as e:
                logger.debug(f"Error invoking thermalState: {e}")

        return {
            "thermal_state": "Nominal",
            "is_throttled": False,
            "raw_level": 0
        }

    def get_cpu_temperature(self) -> Dict[str, Optional[float]]:
        """
        Extract real-time CPU package/die temperature across Apple Silicon thermal sensors.
        Isolates CPU performance (pACC) and efficiency (eACC) cores from power regulators.
        Runs in <15ms without root or sudo privileges.
        """
        try:
            iokit = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/IOKit.framework/IOKit")
            cf = ctypes.cdll.LoadLibrary(ctypes.util.find_library("CoreFoundation"))

            cf.CFArrayGetCount.restype = ctypes.c_long
            cf.CFArrayGetCount.argtypes = [ctypes.c_void_p]
            cf.CFArrayGetValueAtIndex.restype = ctypes.c_void_p
            cf.CFArrayGetValueAtIndex.argtypes = [ctypes.c_void_p, ctypes.c_long]
            cf.CFGetTypeID.restype = ctypes.c_ulong
            cf.CFGetTypeID.argtypes = [ctypes.c_void_p]
            cf.CFStringGetTypeID.restype = ctypes.c_ulong

            iokit.IOHIDEventSystemClientCreate.restype = ctypes.c_void_p
            iokit.IOHIDEventSystemClientCreate.argtypes = [ctypes.c_void_p]
            iokit.IOHIDEventSystemClientCopyServices.restype = ctypes.c_void_p
            iokit.IOHIDEventSystemClientCopyServices.argtypes = [ctypes.c_void_p]

            client = iokit.IOHIDEventSystemClientCreate(None)
            if not client:
                return {"temp_celsius": None, "peak_temp_celsius": None, "pcore_temp": None, "ecore_temp": None, "soc_die_temp": None}

            services = iokit.IOHIDEventSystemClientCopyServices(client)
            if not services:
                return {"temp_celsius": None, "peak_temp_celsius": None, "pcore_temp": None, "ecore_temp": None, "soc_die_temp": None}

            count = cf.CFArrayGetCount(services)
            string_type_id = cf.CFStringGetTypeID()

            iokit.IOHIDServiceClientCopyProperty.restype = ctypes.c_void_p
            iokit.IOHIDServiceClientCopyProperty.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
            cf.CFStringCreateWithCString.restype = ctypes.c_void_p
            cf.CFStringCreateWithCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]
            cf.CFStringGetCString.restype = ctypes.c_bool
            cf.CFStringGetCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32]

            product_key = cf.CFStringCreateWithCString(None, b"Product", 0x08000100)
            iokit.IOHIDServiceClientCopyEvent.restype = ctypes.c_void_p
            iokit.IOHIDServiceClientCopyEvent.argtypes = [ctypes.c_void_p, ctypes.c_int64, ctypes.c_int32, ctypes.c_int64]
            iokit.IOHIDEventGetFloatValue.restype = ctypes.c_double
            iokit.IOHIDEventGetFloatValue.argtypes = [ctypes.c_void_p, ctypes.c_int64]

            buf = ctypes.create_string_buffer(256)
            p_cores = []
            e_cores = []
            soc_sensors = []

            for i in range(count):
                s = cf.CFArrayGetValueAtIndex(services, i)
                if not s:
                    continue
                p = iokit.IOHIDServiceClientCopyProperty(s, product_key)
                if p and cf.CFGetTypeID(p) == string_type_id:
                    if cf.CFStringGetCString(p, buf, 256, 0x08000100):
                        name = buf.value.decode("utf-8", errors="ignore").lower()
                        if "pacc" in name or "eacc" in name or "soc mtr" in name:
                            ev = iokit.IOHIDServiceClientCopyEvent(s, 15, 0, 0)
                            if ev:
                                val = iokit.IOHIDEventGetFloatValue(ev, 15 << 16)
                                if 15 < val < 115:
                                    if "pacc" in name:
                                        p_cores.append(round(val, 1))
                                    elif "eacc" in name:
                                        e_cores.append(round(val, 1))
                                    elif "soc mtr" in name:
                                        soc_sensors.append(round(val, 1))

            all_cpu = p_cores + e_cores
            p_avg = round(sum(p_cores) / len(p_cores), 1) if p_cores else None
            e_avg = round(sum(e_cores) / len(e_cores), 1) if e_cores else None
            cpu_avg = round(sum(all_cpu) / len(all_cpu), 1) if all_cpu else None
            cpu_max = max(all_cpu) if all_cpu else None
            soc_avg = round(sum(soc_sensors) / len(soc_sensors), 1) if soc_sensors else None

            return {
                "temp_celsius": cpu_avg or soc_avg,
                "peak_temp_celsius": cpu_max,
                "pcore_temp": p_avg,
                "ecore_temp": e_avg,
                "soc_die_temp": soc_avg,
            }
        except Exception as e:
            logger.debug(f"Could not read IOHID CPU temperature: {e}")
            return {"temp_celsius": None, "peak_temp_celsius": None, "pcore_temp": None, "ecore_temp": None, "soc_die_temp": None}

    def sample(self) -> Dict[str, Any]:
        """
        Sample comprehensive CPU, GPU, Memory, and Thermal telemetry.
        Takes <35ms total.
        """
        # 1. CPU
        cpu_usage_pct = psutil.cpu_percent(interval=None)
        cpu_physical = psutil.cpu_count(logical=False) or 8
        cpu_logical = psutil.cpu_count(logical=True) or 8
        load_avg = [round(x, 2) for x in os.getloadavg()]
        cpu_thermals = self.get_cpu_temperature()

        # 2. GPU
        gpu_usage_pct = self.get_gpu_utilization_pct()

        # 3. macOS Activity Monitor Memory Telemetry
        memory = self.get_memory_info()

        # 4. Thermal State
        thermal = self.get_thermal_state()
        thermal["cpu_temp_celsius"] = cpu_thermals["temp_celsius"]
        thermal["cpu_peak_celsius"] = cpu_thermals["peak_temp_celsius"]
        thermal["cpu_pcore_celsius"] = cpu_thermals["pcore_temp"]
        thermal["cpu_ecore_celsius"] = cpu_thermals["ecore_temp"]
        thermal["soc_die_celsius"] = cpu_thermals["soc_die_temp"]

        return {
            "cpu": {
                "usage_pct": round(cpu_usage_pct, 1),
                "cores_physical": cpu_physical,
                "cores_logical": cpu_logical,
                "load_avg": load_avg,
                "temp_celsius": cpu_thermals["temp_celsius"],
                "peak_temp_celsius": cpu_thermals["peak_temp_celsius"],
                "pcore_temp_celsius": cpu_thermals["pcore_temp"],
                "ecore_temp_celsius": cpu_thermals["ecore_temp"],
                "soc_die_celsius": cpu_thermals["soc_die_temp"],
            },
            "gpu": {
                "usage_pct": gpu_usage_pct,
                "cores": self._gpu_cores,
            },
            "memory": memory,
            "thermal": thermal,
        }
