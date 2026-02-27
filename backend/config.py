from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data" / "raw"
DB_PATH = BASE_DIR / "forecast.db"

DEFAULT_VELOCITY_WINDOW = 90
DEFAULT_LEAD_TIME_DAYS = 45
SEASONALITY_CLAMP_MIN = 0.3
SEASONALITY_CLAMP_MAX = 3.0
