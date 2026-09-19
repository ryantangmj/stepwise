from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.graph.profiles import PRESET_PROFILES
from app.graph.routing import RouteResult, compute_routes
from app.llm import generate_route_explanation
from app.reports.hazards import build_hazard_penalty_fn, hazards_on_edges
from app.routers.profile import get_custom_profile
from app.schemas import RouteRequest, RouteResponse, RouteStats

router = APIRouter()


def _to_stats(result: RouteResult, db: Session) -> RouteStats:
    return RouteStats(
        kind=result.kind,
        distance_m=round(result.distance_m, 1),
        time_s=round(result.time_s, 1),
        max_grade=round(result.max_grade, 3) if result.max_grade is not None else None,
        is_fully_accessible=result.is_fully_accessible,
        step_count=result.step_count,
        coordinates=[[lat, lon] for lat, lon in result.coordinates],
        hazards_nearby=hazards_on_edges(db, result.edge_ids),
    )


@router.post("/api/routes", response_model=RouteResponse)
def post_routes(req: RouteRequest, db: Session = Depends(get_db)) -> RouteResponse:
    if req.profile == "custom":
        if not req.custom_profile_id:
            raise HTTPException(400, "custom_profile_id is required when profile is 'custom'")
        profile = get_custom_profile(req.custom_profile_id)
        if profile is None:
            raise HTTPException(404, "That custom profile has expired — please describe your needs again")
    else:
        profile = PRESET_PROFILES[req.profile]
    hazard_penalty_fn = build_hazard_penalty_fn(db, profile)
    shortest, stepwise = compute_routes(
        req.start_lat, req.start_lon, req.end_lat, req.end_lon, profile, hazard_penalty_fn
    )

    shortest_stats = _to_stats(shortest, db)
    stepwise_stats = _to_stats(stepwise, db)

    hazards_avoided = len(set(shortest_stats.hazards_nearby) - set(stepwise_stats.hazards_nearby))
    summary = {
        "profile": profile.name,
        "extra_distance_m": round(stepwise.distance_m - shortest.distance_m, 1),
        "extra_time_s": round(stepwise.time_s - shortest.time_s, 1),
        "shortest_max_grade": shortest.max_grade,
        "stepwise_max_grade": stepwise.max_grade,
        "shortest_step_count": shortest.step_count,
        "stepwise_step_count": stepwise.step_count,
        "hazards_avoided": hazards_avoided,
        "shortest_fully_accessible": shortest.is_fully_accessible,
        "stepwise_fully_accessible": stepwise.is_fully_accessible,
    }
    explanation, is_fallback = generate_route_explanation(summary)

    return RouteResponse(
        shortest=shortest_stats,
        stepwise=stepwise_stats,
        explanation=explanation,
        explanation_is_fallback=is_fallback,
    )
