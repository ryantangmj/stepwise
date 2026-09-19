from fastapi import APIRouter, HTTPException

from app.graph.profiles import PRESET_PROFILES
from app.graph.routing import RouteResult, compute_routes
from app.schemas import RouteRequest, RouteResponse, RouteStats

router = APIRouter()


def _to_stats(result: RouteResult) -> RouteStats:
    return RouteStats(
        kind=result.kind,
        distance_m=round(result.distance_m, 1),
        time_s=round(result.time_s, 1),
        max_grade=round(result.max_grade, 3) if result.max_grade is not None else None,
        is_fully_accessible=result.is_fully_accessible,
        step_count=result.step_count,
        coordinates=[[lat, lon] for lat, lon in result.coordinates],
    )


@router.post("/api/routes", response_model=RouteResponse)
def post_routes(req: RouteRequest) -> RouteResponse:
    if req.profile == "custom":
        # Wired up once /api/profile/parse (phase 5) can produce a stored custom profile.
        raise HTTPException(400, "Custom profiles are not yet supported")

    profile = PRESET_PROFILES[req.profile]
    shortest, stepwise = compute_routes(req.start_lat, req.start_lon, req.end_lat, req.end_lon, profile)

    return RouteResponse(
        shortest=_to_stats(shortest),
        stepwise=_to_stats(stepwise),
        # Real AI-generated explanation lands in phase 5; placeholder keeps the API usable now.
        explanation=(
            f"The Stepwise route is about {round(stepwise.distance_m - shortest.distance_m)}m longer "
            f"but keeps the grade under control for a {profile.name} profile."
        ),
        explanation_is_fallback=True,
    )
