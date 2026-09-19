"""Phase 2 smoke test: submit a hazard report mid-block on the shortest demo
route and confirm the wheelchair Stepwise route reroutes around it.

Run with: uv run python -m pytest tests/test_reports.py -v -s
"""
import io

from fastapi.testclient import TestClient
from PIL import Image

from app.db import SessionLocal
from app.graph.profiles import get_profile
from app.graph.routing import compute_routes
from app.main import app
from app.models import Report

client = TestClient(app)


def _test_image_bytes() -> bytes:
    img = Image.new("RGB", (100, 100), color=(90, 80, 70))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_report_reroutes_stepwise_path():
    db = SessionLocal()
    db.query(Report).delete()
    db.commit()
    db.close()

    profile = get_profile("wheelchair")
    shortest, _ = compute_routes(40.4406, -79.9563, 40.4443, -79.9553, profile)

    # Mid-block point on the shortest route's 3rd edge (not a junction, so it
    # snaps unambiguously to an edge the route actually traverses).
    u, v = shortest.node_ids[2], shortest.node_ids[3]
    from app.graph.routing import get_graph

    g = get_graph()
    lat = (g.nodes[u]["y"] + g.nodes[v]["y"]) / 2
    lon = (g.nodes[u]["x"] + g.nodes[v]["x"]) / 2

    resp = client.post(
        "/api/reports",
        files={"photo": ("hazard.jpg", _test_image_bytes(), "image/jpeg")},
        data={"lat": lat, "lon": lon, "note": "test hazard"},
    )
    assert resp.status_code == 200, resp.text
    report = resp.json()
    assert report["status"] == "active"

    routes_resp = client.post(
        "/api/routes",
        json={
            "start_lat": 40.4406, "start_lon": -79.9563,
            "end_lat": 40.4443, "end_lon": -79.9553,
            "profile": "wheelchair",
        },
    )
    assert routes_resp.status_code == 200
    data = routes_resp.json()
    assert report["id"] in data["shortest"]["hazards_nearby"]
    assert report["id"] not in data["stepwise"]["hazards_nearby"]

    # Confirm then deny twice -> auto-resolves and drops out of active reports
    client.post(f"/api/reports/{report['id']}/confirm", json={"still_there": True})
    client.post(f"/api/reports/{report['id']}/confirm", json={"still_there": False})
    resp = client.post(f"/api/reports/{report['id']}/confirm", json={"still_there": False})
    assert resp.json()["status"] == "resolved"

    active = client.get("/api/reports").json()
    assert all(r["id"] != report["id"] for r in active)
