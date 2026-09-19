from fastapi import APIRouter

from app import config
from app.schemas import ConfigResponse

router = APIRouter()


@router.get("/api/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    return ConfigResponse(
        bbox={
            "north": config.BBOX_NORTH,
            "south": config.BBOX_SOUTH,
            "east": config.BBOX_EAST,
            "west": config.BBOX_WEST,
        },
        demo_start={"lat": config.DEMO_START[0], "lon": config.DEMO_START[1]},
        demo_end={"lat": config.DEMO_END[0], "lon": config.DEMO_END[1]},
        demo_mode=config.DEMO_MODE,
    )
