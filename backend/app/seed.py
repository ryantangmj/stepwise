"""Demo seed data: loads backend/seed_photos/seed_reports.json into the
reports table, snapped to the cached graph, with pre-written VLM verdicts
(no live API calls) so the demo is reproducible offline. Generates a simple
placeholder photo for any entry whose photo file is missing, so this works
even before you've added real photos.
"""
from __future__ import annotations

import json
import logging
import uuid

from PIL import Image, ImageDraw
from sqlalchemy.orm import Session

from app import config
from app.graph.routing import get_graph
from app.models import Report
from app.reports.photos import strip_exif
from app.reports.snapping import snap_to_edge

logger = logging.getLogger("stepwise.seed")

SEED_REPORTS_JSON = config.SEED_PHOTOS_DIR / "seed_reports.json"

PLACEHOLDER_COLORS = {
    "crack": (150, 140, 120),
    "heave": (140, 110, 90),
    "missing_curb_cut": (120, 130, 150),
    "steep_ramp": (160, 120, 90),
    "obstruction": (130, 130, 130),
    "standing_water": (90, 120, 150),
    "broken_surface": (110, 100, 95),
    "stairs_only": (100, 100, 110),
    "construction": (200, 160, 60),
}


def _generate_placeholder_photo(hazard_type: str, path) -> None:
    color = PLACEHOLDER_COLORS.get(hazard_type, (140, 140, 140))
    img = Image.new("RGB", (640, 480), color=color)
    draw = ImageDraw.Draw(img)
    label = f"SEED PHOTO\n{hazard_type.replace('_', ' ').title()}"
    draw.multiline_text((24, 24), label, fill=(255, 255, 255), spacing=8)
    img.save(path, format="JPEG", quality=85)
    logger.info("Generated placeholder photo for %s at %s", hazard_type, path)


def _load_seed_entries() -> list[dict]:
    if not SEED_REPORTS_JSON.exists():
        logger.warning("No seed_reports.json found at %s, skipping seed", SEED_REPORTS_JSON)
        return []
    return json.loads(SEED_REPORTS_JSON.read_text())


def seed_demo_reports(db: Session) -> list[Report]:
    """Clear all reports and their photos, then reload from seed_reports.json.
    Used by both scripts/seed_demo.py and POST /api/demo/reset."""
    db.query(Report).delete()
    db.commit()
    for f in config.UPLOADS_DIR.glob("*.jpg"):
        f.unlink()

    entries = _load_seed_entries()
    if not entries:
        return []

    graph = get_graph()
    created: list[Report] = []

    for entry in entries:
        photo_path = config.SEED_PHOTOS_DIR / entry["photo"]
        if not photo_path.exists():
            _generate_placeholder_photo(entry["vlm"]["hazard_type"], photo_path)

        clean_bytes = strip_exif(photo_path.read_bytes())
        report_id = uuid.uuid4().hex
        (config.UPLOADS_DIR / f"{report_id}.jpg").write_bytes(clean_bytes)

        edge_id = snap_to_edge(graph, entry["lat"], entry["lon"])
        vlm = entry["vlm"]
        report = Report(
            id=report_id,
            lat=entry["lat"],
            lon=entry["lon"],
            snapped_edge_id=edge_id,
            photo_path=str(config.UPLOADS_DIR / f"{report_id}.jpg"),
            hazard_type=vlm["hazard_type"],
            severity=vlm["severity"],
            passability_wheelchair=vlm["passability"]["wheelchair"],
            passability_walker=vlm["passability"]["walker"],
            passability_cane=vlm["passability"]["cane"],
            base_confidence=vlm["confidence"],
            estimated_level_change_cm=vlm.get("estimated_level_change_cm"),
            needs_better_photo=vlm.get("needs_better_photo", False),
            follow_up_question=vlm.get("follow_up_question"),
            reason=vlm["reason"],
            note=entry.get("note"),
            used_fallback=False,
        )
        db.add(report)
        created.append(report)

    db.commit()
    logger.info("Seeded %d demo reports", len(created))
    return created
