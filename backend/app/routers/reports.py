from __future__ import annotations

import datetime as dt
import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import config
from app.db import get_db
from app.graph.routing import get_graph
from app.llm import analyze_hazard_photo
from app.models import Report
from app.reports.decay import effective_confidence
from app.reports.photos import strip_exif
from app.reports.snapping import haversine_m, snap_to_edge
from app.schemas import ConfirmRequest, Passability, ReportOut

router = APIRouter()
logger = logging.getLogger("stepwise.reports")

DUPLICATE_RADIUS_M = 10.0


def _report_to_out(report: Report) -> ReportOut:
    return ReportOut(
        id=report.id,
        lat=report.lat,
        lon=report.lon,
        photo_url=f"/uploads/{report.id}.jpg",
        hazard_type=report.hazard_type,
        severity=report.severity,
        passability=Passability(
            wheelchair=report.passability_wheelchair,
            walker=report.passability_walker,
            cane=report.passability_cane,
        ),
        confidence=round(effective_confidence(report), 2),
        estimated_level_change_cm=report.estimated_level_change_cm,
        needs_better_photo=report.needs_better_photo,
        follow_up_question=report.follow_up_question,
        reason=report.reason,
        status=report.status,
        confirmations=report.confirmations,
        denials=report.denials,
        created_at=report.created_at,
        last_confirmed_at=report.last_confirmed_at,
        used_fallback=report.used_fallback,
    )


@router.get("/api/reports", response_model=list[ReportOut])
def list_reports(db: Session = Depends(get_db)) -> list[ReportOut]:
    reports = db.query(Report).filter(Report.status == "active").all()
    return [_report_to_out(r) for r in reports]


@router.post("/api/reports", response_model=ReportOut)
def create_report(
    photo: UploadFile = File(...),
    lat: float = Form(...),
    lon: float = Form(...),
    note: str | None = Form(None),
    db: Session = Depends(get_db),
) -> ReportOut:
    raw_bytes = photo.file.read()
    if not raw_bytes:
        raise HTTPException(400, "Empty photo upload")

    try:
        clean_bytes = strip_exif(raw_bytes)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, "Could not read that image — please try another photo") from exc

    analysis, used_fallback = analyze_hazard_photo(clean_bytes, note)

    if not analysis.is_sidewalk_hazard_photo:
        raise HTTPException(
            422,
            "That doesn't look like a sidewalk or path hazard — try a clearer photo of the specific spot.",
        )

    # Duplicate merge: a same-type report within ~10m of an active one boosts it
    # instead of creating a new pin (see app/reports/decay.py for the confidence math).
    candidates = (
        db.query(Report)
        .filter(Report.status == "active", Report.hazard_type == analysis.hazard_type)
        .all()
    )
    for existing in candidates:
        if haversine_m(lat, lon, existing.lat, existing.lon) <= DUPLICATE_RADIUS_M:
            existing.confirmations += 1
            existing.last_confirmed_at = dt.datetime.now(dt.timezone.utc)
            existing.base_confidence = max(existing.base_confidence, analysis.confidence)
            db.commit()
            db.refresh(existing)
            logger.info("Merged new report into existing %s (within %.0fm)", existing.id, DUPLICATE_RADIUS_M)
            return _report_to_out(existing)

    report_id = uuid.uuid4().hex
    photo_path = config.UPLOADS_DIR / f"{report_id}.jpg"
    photo_path.write_bytes(clean_bytes)

    graph = get_graph()
    edge_id = snap_to_edge(graph, lat, lon)

    report = Report(
        id=report_id,
        lat=lat,
        lon=lon,
        snapped_edge_id=edge_id,
        photo_path=str(photo_path),
        hazard_type=analysis.hazard_type,
        severity=analysis.severity,
        passability_wheelchair=analysis.passability.wheelchair,
        passability_walker=analysis.passability.walker,
        passability_cane=analysis.passability.cane,
        base_confidence=analysis.confidence,
        estimated_level_change_cm=analysis.estimated_level_change_cm,
        needs_better_photo=analysis.needs_better_photo,
        follow_up_question=analysis.follow_up_question,
        reason=analysis.reason,
        note=note,
        used_fallback=used_fallback,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_to_out(report)


@router.post("/api/reports/{report_id}/confirm", response_model=ReportOut)
def confirm_report(report_id: str, body: ConfirmRequest, db: Session = Depends(get_db)) -> ReportOut:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")

    if body.still_there:
        report.confirmations += 1
        report.last_confirmed_at = dt.datetime.now(dt.timezone.utc)
    else:
        report.denials += 1
        if report.denials >= 2:
            report.status = "resolved"

    db.commit()
    db.refresh(report)
    return _report_to_out(report)
