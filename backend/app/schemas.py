"""Pydantic schemas shared across API routers and LLM structured outputs."""
from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

ProfileName = Literal["wheelchair", "walker", "cane", "custom"]

PassabilityLevel = Literal["passable", "difficult", "impassable"]

HazardType = Literal[
    "crack",
    "heave",
    "missing_curb_cut",
    "steep_ramp",
    "obstruction",
    "standing_water",
    "broken_surface",
    "stairs_only",
    "construction",
    "none",
]


class Passability(BaseModel):
    wheelchair: PassabilityLevel
    walker: PassabilityLevel
    cane: PassabilityLevel


class ConfigResponse(BaseModel):
    bbox: dict[str, float]
    demo_start: dict[str, float]
    demo_end: dict[str, float]
    demo_mode: bool


class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    profile: ProfileName = "wheelchair"
    # Only used when profile == "custom"; id of a previously parsed custom profile.
    custom_profile_id: str | None = None


class RouteStats(BaseModel):
    kind: Literal["shortest", "stepwise"]
    distance_m: float
    time_s: float
    max_grade: float | None
    is_fully_accessible: bool
    step_count: int
    coordinates: list[list[float]] = Field(description="[[lat, lon], ...] in path order")
    hazards_nearby: list[str] = Field(default_factory=list, description="Report ids near this route")


class RouteResponse(BaseModel):
    shortest: RouteStats
    stepwise: RouteStats
    explanation: str
    explanation_is_fallback: bool = False


class ReportOut(BaseModel):
    id: str
    lat: float
    lon: float
    photo_url: str
    hazard_type: HazardType
    severity: int
    passability: Passability
    confidence: float
    estimated_level_change_cm: float | None
    needs_better_photo: bool
    follow_up_question: str | None
    reason: str
    status: Literal["active", "resolved", "expired"]
    confirmations: int
    denials: int
    created_at: dt.datetime
    last_confirmed_at: dt.datetime
    used_fallback: bool


class ConfirmRequest(BaseModel):
    still_there: bool


class GeocodeResult(BaseModel):
    lat: float
    lon: float
    display_name: str


class ProfileParseRequest(BaseModel):
    text: str


class ProfileParseResponse(BaseModel):
    profile_id: str
    base_profile: Literal["wheelchair", "walker", "cane"]
    max_comfortable_grade: float | None
    hard_max_grade: float | None
    max_continuous_walk_m: float | None
    avoid_uncontrolled_crossings: bool
    prefer_rest_points: bool
    notes: str
    summary: str = Field(description="Plain-language restatement of the parsed profile, for user confirmation")
    is_fallback: bool = False
