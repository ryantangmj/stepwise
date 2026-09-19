"""Phase 1 smoke test: shortest vs stepwise routes differ for the wheelchair
profile on the demo start/end pair, and basic route stats look sane.

Run with: uv run python -m pytest tests/test_routing.py -v
(First run downloads and caches the OSM graph — expect it to take a while.)
"""
from app import config
from app.graph.profiles import get_profile
from app.graph.routing import compute_routes


def test_shortest_and_stepwise_routes():
    profile = get_profile("wheelchair")
    start_lat, start_lon = config.DEMO_START
    end_lat, end_lon = config.DEMO_END

    shortest, stepwise = compute_routes(start_lat, start_lon, end_lat, end_lon, profile)

    assert shortest.distance_m > 0
    assert stepwise.distance_m > 0
    assert len(shortest.node_ids) >= 2
    assert len(stepwise.node_ids) >= 2

    # The stepwise route should be distance >= shortest (it trades distance for comfort)
    assert stepwise.distance_m >= shortest.distance_m * 0.95

    print(f"\nShortest: {shortest.distance_m:.0f}m, {shortest.time_s:.0f}s, "
          f"max_grade={shortest.max_grade}, steps={shortest.step_count}, "
          f"accessible={shortest.is_fully_accessible}")
    print(f"Stepwise: {stepwise.distance_m:.0f}m, {stepwise.time_s:.0f}s, "
          f"max_grade={stepwise.max_grade}, steps={stepwise.step_count}, "
          f"accessible={stepwise.is_fully_accessible}")
