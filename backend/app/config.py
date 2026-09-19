"""Central configuration, loaded from environment / .env."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
DATA_DIR = APP_DIR / "data"
UPLOADS_DIR = BACKEND_DIR / "uploads"
DB_PATH = BACKEND_DIR / "stepwise.db"
SEED_PHOTOS_DIR = BACKEND_DIR / "seed_photos"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

GRAPH_CACHE_PATH = DATA_DIR / "graph.graphml"
ELEVATION_CACHE_PATH = DATA_DIR / "elevation_cache.json"

# (north, south, east, west) — default: Oakland, Pittsburgh
BBOX_NORTH = float(os.getenv("BBOX_NORTH", "40.450"))
BBOX_SOUTH = float(os.getenv("BBOX_SOUTH", "40.435"))
BBOX_EAST = float(os.getenv("BBOX_EAST", "-79.945"))
BBOX_WEST = float(os.getenv("BBOX_WEST", "-79.965"))
# osmnx wants (left, bottom, right, top) = (west, south, east, north)
BBOX_OSMNX = (BBOX_WEST, BBOX_SOUTH, BBOX_EAST, BBOX_NORTH)

DEMO_START = (
    float(os.getenv("DEMO_START_LAT", "40.4406")),
    float(os.getenv("DEMO_START_LON", "-79.9563")),
)
DEMO_END = (
    float(os.getenv("DEMO_END_LAT", "40.4443")),
    float(os.getenv("DEMO_END_LON", "-79.9553")),
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
VLM_MODEL = os.getenv("VLM_MODEL", "")
TEXT_MODEL = os.getenv("TEXT_MODEL", "")

REPORT_DECAY_DAYS = float(os.getenv("REPORT_DECAY_DAYS", "14"))
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"

# Seconds to wait on an LLM call before falling back (demo mode only).
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "8"))

# Average walking speeds (m/s) used to estimate travel time per profile.
WALK_SPEED_MPS = {
    "wheelchair": 1.0,
    "walker": 0.8,
    "cane": 0.9,
    "custom": 0.9,
}
