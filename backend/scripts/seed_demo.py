"""CLI entrypoint for seeding demo reports.

Usage: uv run python -m scripts.seed_demo
Edit backend/seed_photos/seed_reports.json to change what gets seeded, and
drop real photos into backend/seed_photos/ (matching the "photo" filenames)
to replace the auto-generated placeholders.
"""
import logging

from app.db import SessionLocal, init_db
from app.seed import seed_demo_reports

logging.basicConfig(level=logging.INFO)


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        reports = seed_demo_reports(db)
        print(f"Seeded {len(reports)} demo report(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
