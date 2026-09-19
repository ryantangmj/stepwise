"""Mobility profile definitions, expressed as data consumed by weights.py.

A profile is plain data so new ones (including LLM-parsed custom profiles)
can be added without touching the edge-cost logic.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class MobilityProfile:
    name: str
    max_comfortable_grade: float  # fraction, e.g. 0.05 = 5%
    hard_max_grade: float
    steps_impassable: bool
    step_penalty_factor: float  # multiplier added to cost when steps are merely penalized (not impassable)
    hazard_sensitivity: float  # 0-1+, scales hazard_penalty
    requires_curb_cuts: bool = False
    max_continuous_walk_m: float | None = None
    avoid_uncontrolled_crossings: bool = False
    prefer_rest_points: bool = False
    notes: str = ""


PRESET_PROFILES: dict[str, MobilityProfile] = {
    "wheelchair": MobilityProfile(
        name="wheelchair",
        max_comfortable_grade=0.05,
        hard_max_grade=0.08,
        steps_impassable=True,
        step_penalty_factor=0.0,
        hazard_sensitivity=1.2,
        requires_curb_cuts=True,
    ),
    "walker": MobilityProfile(
        name="walker",
        max_comfortable_grade=0.06,
        hard_max_grade=0.10,
        steps_impassable=True,
        step_penalty_factor=0.0,
        hazard_sensitivity=1.1,
        requires_curb_cuts=False,
        prefer_rest_points=True,
    ),
    "cane": MobilityProfile(
        name="cane",
        max_comfortable_grade=0.08,
        hard_max_grade=0.12,
        steps_impassable=False,
        step_penalty_factor=2.0,
        hazard_sensitivity=0.8,
        requires_curb_cuts=False,
    ),
}


def custom_profile_from_fields(
    *,
    base_profile: str,
    max_comfortable_grade: float | None,
    hard_max_grade: float | None,
    max_continuous_walk_m: float | None,
    avoid_uncontrolled_crossings: bool,
    prefer_rest_points: bool,
    notes: str,
) -> MobilityProfile:
    """Build a custom profile by overlaying LLM-parsed fields on a preset base."""
    base = PRESET_PROFILES.get(base_profile, PRESET_PROFILES["cane"])
    return MobilityProfile(
        name="custom",
        max_comfortable_grade=max_comfortable_grade or base.max_comfortable_grade,
        hard_max_grade=hard_max_grade or base.hard_max_grade,
        steps_impassable=base.steps_impassable,
        step_penalty_factor=base.step_penalty_factor,
        hazard_sensitivity=base.hazard_sensitivity,
        requires_curb_cuts=base.requires_curb_cuts,
        max_continuous_walk_m=max_continuous_walk_m,
        avoid_uncontrolled_crossings=avoid_uncontrolled_crossings,
        prefer_rest_points=prefer_rest_points,
        notes=notes,
    )


def get_profile(name: str) -> MobilityProfile:
    if name not in PRESET_PROFILES:
        raise KeyError(f"Unknown profile preset: {name}")
    return PRESET_PROFILES[name]
