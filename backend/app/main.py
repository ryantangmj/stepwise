import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import config as config_router
from app.routers import routes as routes_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Stepwise API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon scope: single local demo, no auth
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config_router.router)
app.include_router(routes_router.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
