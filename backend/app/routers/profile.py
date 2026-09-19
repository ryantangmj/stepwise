"""Natural-language mobility profile parsing.

Parsed custom profiles are kept in an in-memory dict keyed by a generated id
(no user accounts in this app, so no need for DB persistence — a restart
just means a returning user re-describes their needs, which is fine at
hackathon scope). /api/routes looks profiles up by this id when profile="custom".
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.graph.profiles import MobilityProfile, custom_profile_from_fields
from app.llm import parse_profile_text
from app.schemas import ProfileParseRequest, ProfileParseResponse

router = APIRouter()

_custom_profiles: dict[str, MobilityProfile] = {}


def get_custom_profile(profile_id: str) -> MobilityProfile | None:
    return _custom_profiles.get(profile_id)


@router.post("/api/profile/parse", response_model=ProfileParseResponse)
def parse_profile(req: ProfileParseRequest) -> ProfileParseResponse:
    parsed, is_fallback = parse_profile_text(req.text)

    profile = custom_profile_from_fields(
        base_profile=parsed.base_profile,
        max_comfortable_grade=parsed.max_comfortable_grade,
        hard_max_grade=parsed.hard_max_grade,
        max_continuous_walk_m=parsed.max_continuous_walk_m,
        avoid_uncontrolled_crossings=parsed.avoid_uncontrolled_crossings,
        prefer_rest_points=parsed.prefer_rest_points,
        notes=parsed.notes,
    )
    profile_id = uuid.uuid4().hex
    _custom_profiles[profile_id] = profile

    return ProfileParseResponse(
        profile_id=profile_id,
        base_profile=parsed.base_profile,
        max_comfortable_grade=parsed.max_comfortable_grade,
        hard_max_grade=parsed.hard_max_grade,
        max_continuous_walk_m=parsed.max_continuous_walk_m,
        avoid_uncontrolled_crossings=parsed.avoid_uncontrolled_crossings,
        prefer_rest_points=parsed.prefer_rest_points,
        notes=parsed.notes,
        summary=parsed.summary,
        is_fallback=is_fallback,
    )
