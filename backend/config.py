import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root if it exists
project_root = Path(__file__).resolve().parent.parent
dotenv_path = project_root / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    load_dotenv()

MACAI_DB_PATH = os.getenv("MACAI_DB_PATH", str(project_root / "macai_observatory.db"))
MACAI_SAMPLE_INTERVAL_SECONDS = int(os.getenv("MACAI_SAMPLE_INTERVAL_SECONDS", "3"))
MACAI_HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("MACAI_HEARTBEAT_TIMEOUT_SECONDS", str(MACAI_SAMPLE_INTERVAL_SECONDS * 3)))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

MACAI_DEMO_DIR = os.getenv("MACAI_DEMO_DIR", "/tmp/macai_demo")

# Alert thresholds
CAPACITY_WARNING_PCT = float(os.getenv("CAPACITY_WARNING_PCT", "80.0"))
CAPACITY_CRITICAL_PCT = float(os.getenv("CAPACITY_CRITICAL_PCT", "90.0"))
ABNORMAL_WRITE_MULTIPLIER = float(os.getenv("ABNORMAL_WRITE_MULTIPLIER", "3.0"))
ABNORMAL_WRITE_MIN_BPS = float(os.getenv("ABNORMAL_WRITE_MIN_BPS", str(10 * 1024 * 1024))) # 10 MB/s minimum to trigger
