"""Waze-style confidence decay for hazard reports, computed at routing time
(rather than as a background job) so it's always up to date with `now`."""
from __future__ import annotations

import datetime as dt

from app import config
from app.models import Report

CONFIRMATION_BOOST = 0.15
DENIAL_PENALTY = 0.3


def effective_confidence(report: Report, now: dt.datetime | None = None) -> float:
    now = now or dt.datetime.now(dt.timezone.utc)

    adjusted = report.base_confidence + CONFIRMATION_BOOST * report.confirmations - DENIAL_PENALTY * report.denials
    adjusted = max(0.0, min(1.0, adjusted))

    last_confirmed = report.last_confirmed_at
    if last_confirmed.tzinfo is None:
        last_confirmed = last_confirmed.replace(tzinfo=dt.timezone.utc)
    age_days = (now - last_confirmed).total_seconds() / 86400.0

    if config.REPORT_DECAY_DAYS <= 0:
        decay = 1.0
    else:
        decay = max(0.0, 1.0 - age_days / config.REPORT_DECAY_DAYS)

    return adjusted * decay
