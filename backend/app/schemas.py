"""Pydantic schemas shared across API routers and LLM structured outputs."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ProfileName = Literal["wheelchair", "walker", "cane", "custom"]


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
