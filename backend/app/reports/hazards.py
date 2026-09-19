"""Turn active hazard reports into a per-edge routing penalty, and find which
reports lie along a given route (for the "hazards passed near" UI list)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.graph.edge_ids import canonical_edge_id
from app.graph.profiles import MobilityProfile
from app.graph.routing import HazardPenaltyFn
from app.models import Report
from app.reports.decay import effective_confidence

# Base multiplier by how passable the hazard is for a given profile; scaled
# further by severity and by the report's (decayed) confidence.
PASSABILITY_PENALTY = {"passable": 0.1, "difficult": 1.0, "impassable": 8.0}

PROFILE_PASSABILITY_KEY = {"wheelchair": "wheelchair", "walker": "walker", "cane": "cane"}


def _passability_key(profile: MobilityProfile) -> str:
    return PROFILE_PASSABILITY_KEY.get(profile.name, "cane")


def _active_reports(db: Session) -> list[Report]:
    return db.query(Report).filter(Report.status == "active").all()


def build_hazard_penalty_fn(db: Session, profile: MobilityProfile) -> HazardPenaltyFn:
    key = _passability_key(profile)
    penalty_by_edge: dict[str, float] = {}

    for report in _active_reports(db):
        confidence = effective_confidence(report)
        if confidence <= 0:
            continue
        passability = getattr(report, f"passability_{key}")
        base_penalty = PASSABILITY_PENALTY.get(passability, 1.0)
        severity_factor = 0.5 + 0.5 * (report.severity / 5.0)
        penalty = base_penalty * severity_factor * confidence
        penalty_by_edge[report.snapped_edge_id] = penalty_by_edge.get(report.snapped_edge_id, 0.0) + penalty

    def hazard_penalty_fn(u: int, v: int, k: int) -> float:
        return penalty_by_edge.get(canonical_edge_id(u, v, k), 0.0)

    return hazard_penalty_fn


def hazards_on_edges(db: Session, edge_ids: list[str]) -> list[str]:
    """Ids of active reports whose snapped edge is one of the given canonical edge ids."""
    if not edge_ids:
        return []
    reports = db.query(Report.id).filter(Report.status == "active", Report.snapped_edge_id.in_(edge_ids)).all()
    return [r.id for r in reports]
