import os
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(__file__).resolve().parent.parent
dotenv_path = project_root / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    load_dotenv()

MACAI_COORDINATOR_URL = os.getenv("MACAI_COORDINATOR_URL", "http://localhost:8000").rstrip("/")
MACAI_SAMPLE_INTERVAL_SECONDS = int(os.getenv("MACAI_SAMPLE_INTERVAL_SECONDS", "3"))
