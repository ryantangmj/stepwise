"""Address search for the start/end pickers, proxied through the backend.

Kept server-side (rather than called from the browser) so we can send a real
User-Agent identifying the app, per Nominatim's usage policy, and so a
slow/unreachable geocoder degrades to an empty result list — same graceful
degradation shape as elevation.py — instead of breaking the picker (tapping
the map to set a point still always works regardless).
"""
import logging

import requests
from fastapi import APIRouter, Query

from app import config
from app.schemas import GeocodeResult

logger = logging.getLogger("stepwise.geocode")

router = APIRouter()

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
REQUEST_TIMEOUT_S = 5


@router.get("/api/geocode", response_model=list[GeocodeResult])
def geocode(q: str = Query(min_length=2)) -> list[GeocodeResult]:
    params = {
        "q": q,
        "format": "jsonv2",
        "limit": 5,
        # Nominatim wants (left, top, right, bottom) = (west, north, east, south).
        "viewbox": f"{config.BBOX_WEST},{config.BBOX_NORTH},{config.BBOX_EAST},{config.BBOX_SOUTH}",
        "bounded": 1,
    }
    headers = {"User-Agent": "Stepwise-Hackathon-Demo/1.0 (accessible pedestrian routing)"}
    try:
        resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=REQUEST_TIMEOUT_S)
        resp.raise_for_status()
        results = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Nominatim geocode failed (%s); returning no results", exc)
        return []
    return [GeocodeResult(lat=float(r["lat"]), lon=float(r["lon"]), display_name=r["display_name"]) for r in results]
