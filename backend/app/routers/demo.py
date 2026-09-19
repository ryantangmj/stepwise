from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.seed import seed_demo_reports

router = APIRouter()


@router.post("/api/demo/reset")
def reset_demo(db: Session = Depends(get_db)) -> dict:
    """Restores the seed hazard reports, so the demo can be rerun repeatedly."""
    reports = seed_demo_reports(db)
    return {"status": "ok", "reports_seeded": len(reports)}
