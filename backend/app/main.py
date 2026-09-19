import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import config
from app.db import SessionLocal, init_db
from app.models import Report
from app.routers import config as config_router
from app.routers import demo as demo_router
from app.routers import geocode as geocode_router
from app.routers import profile as profile_router
from app.routers import reports as reports_router
from app.routers import routes as routes_router
from app.seed import seed_demo_reports

logging.basicConfig(level=logging.INFO)

init_db()

if config.DEMO_MODE:
    # First-run convenience: give a fresh checkout something to show without
    # a manual seed step. POST /api/demo/reset re-seeds on demand afterward.
    _db = SessionLocal()
    try:
        if _db.query(Report).count() == 0:
            seed_demo_reports(_db)
    finally:
        _db.close()

app = FastAPI(title="Stepwise API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon scope: single local demo, no auth
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=config.UPLOADS_DIR), name="uploads")

app.include_router(config_router.router)
app.include_router(routes_router.router)
app.include_router(reports_router.router)
app.include_router(profile_router.router)
app.include_router(demo_router.router)
app.include_router(geocode_router.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
