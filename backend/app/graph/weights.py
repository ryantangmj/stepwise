"""Per-profile edge cost function.

edge_cost = length_m * (1 + slope_penalty + surface_penalty + crossing_penalty
                           + hazard_penalty + step_penalty)

Steps are either impassable (inf cost) or heavily penalized depending on the
profile. Grade above the hard max is impassable; above the comfortable
threshold it grows smoothly so routes prefer gentler streets even when a
steeper shortcut exists. OSM tags we don't recognize (or that are absent)
carry a small "uncertainty" penalty rather than being treated as perfect,
since an unknown surface is a real (if small) risk for these users.
"""
from __future__ import annotations

import math
from typing import Any

from app.graph.profiles import MobilityProfile

INF = float("inf")

UNKNOWN_TAG_PENALTY = 0.05

SURFACE_PENALTY = {
    "paved": 0.0,
    "asphalt": 0.0,
    "concrete": 0.0,
    "paving_stones": 0.02,
    "sett": 0.15,
    "cobblestone": 0.2,
    "compacted": 0.1,
    "fine_gravel": 0.2,
    "gravel": 0.4,
    "unpaved": 0.4,
    "dirt": 0.45,
    "earth": 0.45,
    "ground": 0.4,
    "grass": 0.5,
    "sand": 0.6,
    "mud": 0.7,
}

SMOOTHNESS_PENALTY = {
    "excellent": 0.0,
    "good": 0.0,
    "intermediate": 0.08,
    "bad": 0.25,
    "very_bad": 0.5,
    "horrible": 0.8,
    "very_horrible": 1.2,
    "impassable": INF,
}


def _first(value: Any) -> Any:
    """osmnx stores merged-edge tags as lists sometimes; take the first value."""
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _parse_incline_pct(value: Any) -> float | None:
    value = _first(value)
    if not isinstance(value, str):
        return None
    value = value.strip()
    if value in ("up", "down"):
        return None  # direction only, no magnitude
    if value.endswith("%"):
        try:
            return abs(float(value[:-1])) / 100.0
        except ValueError:
            return None
    return None


def _edge_grade(data: dict) -> float | None:
    """Best-known grade for an edge: max of elevation-derived grade and any
    explicit OSM incline tag (whichever is more conservative)."""
    candidates = []
    grade = data.get("grade")
    if grade is not None:
        candidates.append(grade)
    incline_grade = _parse_incline_pct(data.get("incline"))
    if incline_grade is not None:
        candidates.append(incline_grade)
    return max(candidates) if candidates else None


def _slope_penalty(data: dict, profile: MobilityProfile) -> float:
    grade = _edge_grade(data)
    if grade is None:
        return UNKNOWN_TAG_PENALTY
    if grade > profile.hard_max_grade:
        return INF
    if grade <= profile.max_comfortable_grade:
        return 0.0
    # Grows from 0 at comfortable threshold to 3.0 at the hard max.
    span = profile.hard_max_grade - profile.max_comfortable_grade
    excess = grade - profile.max_comfortable_grade
    return 3.0 * (excess / span) ** 1.5 if span > 0 else INF


def _surface_penalty(data: dict) -> float:
    surface = _first(data.get("surface"))
    smoothness = _first(data.get("smoothness"))
    penalty = UNKNOWN_TAG_PENALTY if surface is None else SURFACE_PENALTY.get(surface, UNKNOWN_TAG_PENALTY)
    if smoothness is not None:
        smoothness_penalty = SMOOTHNESS_PENALTY.get(smoothness, UNKNOWN_TAG_PENALTY)
        penalty = max(penalty, smoothness_penalty)
    return penalty


def _crossing_penalty(data: dict, profile: MobilityProfile) -> float:
    """Penalize crossings without curb cuts / with uncontrolled crossings."""
    highway = _first(data.get("highway"))
    if highway != "crossing" and _first(data.get("footway")) != "crossing":
        return 0.0

    kerb = _first(data.get("kerb"))
    penalty = 0.0
    if kerb in ("flush", "lowered"):
        penalty += 0.0
    elif kerb == "raised":
        penalty += INF if profile.requires_curb_cuts else 0.3
    else:
        penalty += UNKNOWN_TAG_PENALTY if not profile.requires_curb_cuts else 0.15

    crossing = _first(data.get("crossing"))
    if profile.avoid_uncontrolled_crossings and crossing in ("uncontrolled", "unmarked", None):
        penalty += 0.3
    return penalty


def _step_penalty(data: dict, profile: MobilityProfile) -> float:
    highway = _first(data.get("highway"))
    if highway != "steps":
        return 0.0
    return INF if profile.steps_impassable else profile.step_penalty_factor


def edge_cost(u: int, v: int, data: dict, profile: MobilityProfile, hazard_penalty: float = 0.0) -> float:
    """Cost of traversing one edge for the given profile. inf = impassable."""
    length = data.get("length", 0.0) or 0.0
    if length <= 0:
        return INF

    step_pen = _step_penalty(data, profile)
    if step_pen == INF:
        return INF
    slope_pen = _slope_penalty(data, profile)
    if slope_pen == INF:
        return INF

    surface_pen = _surface_penalty(data)
    crossing_pen = _crossing_penalty(data, profile)
    if crossing_pen == INF:
        return INF

    total_penalty = slope_pen + surface_pen + crossing_pen + hazard_penalty * profile.hazard_sensitivity + step_pen
    return length * (1.0 + total_penalty)


def shortest_distance_cost(u: int, v: int, data: dict) -> float:
    """Plain distance weight, for the baseline 'Shortest' route (steps still block it)."""
    length = data.get("length", 0.0) or 0.0
    if length <= 0:
        return INF
    if _first(data.get("highway")) == "steps":
        return length  # a pedestrian can still use literal steps for the shortest-path baseline
    return length
