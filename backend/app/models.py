from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    # Canonical (undirected) "u_v_k" id of the nearest walkable edge — see reports/snapping.py.
    snapped_edge_id: Mapped[str] = mapped_column(String, index=True)
    photo_path: Mapped[str] = mapped_column(String)

    hazard_type: Mapped[str] = mapped_column(String)
    severity: Mapped[int] = mapped_column(Integer)
    passability_wheelchair: Mapped[str] = mapped_column(String)
    passability_walker: Mapped[str] = mapped_column(String)
    passability_cane: Mapped[str] = mapped_column(String)
    base_confidence: Mapped[float] = mapped_column(Float)
    estimated_level_change_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    needs_better_photo: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    used_fallback: Mapped[bool] = mapped_column(Boolean, default=False)

    status: Mapped[str] = mapped_column(String, default="active")  # active | resolved | expired
    confirmations: Mapped[int] = mapped_column(Integer, default=0)
    denials: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_confirmed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
