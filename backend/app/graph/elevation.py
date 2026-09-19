"""Attach node elevations (OpenTopoData) and compute edge grades.

Degrades gracefully: if the API is unreachable or rate-limited, nodes are left
without an 'elevation' attribute and edges without a 'grade' attribute. Callers
(weights.py) must treat missing grade as "unknown" rather than crashing.
"""
from __future__ import annotations

import json
import logging
import time

import networkx as nx
import requests

from app import config

logger = logging.getLogger("stepwise.elevation")

OPENTOPODATA_URL = "https://api.opentopodata.org/v1/srtm90m"
BATCH_SIZE = 100  # OpenTopoData public API limit per request
REQUEST_DELAY_S = 1.0  # public API rate limit is ~1 req/sec
REQUEST_TIMEOUT_S = 10


def _cache_key(lat: float, lon: float) -> str:
    return f"{lat:.5f},{lon:.5f}"


def _load_cache() -> dict[str, float]:
    if config.ELEVATION_CACHE_PATH.exists():
        try:
            return json.loads(config.ELEVATION_CACHE_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Elevation cache unreadable, starting fresh")
    return {}


def _save_cache(cache: dict[str, float]) -> None:
    config.ELEVATION_CACHE_PATH.write_text(json.dumps(cache))


def _fetch_batch(coords: list[tuple[float, float]]) -> list[float | None]:
    locations = "|".join(f"{lat},{lon}" for lat, lon in coords)
    resp = requests.get(OPENTOPODATA_URL, params={"locations": locations}, timeout=REQUEST_TIMEOUT_S)
    resp.raise_for_status()
    data = resp.json()
    return [r.get("elevation") for r in data.get("results", [])]


def attach_elevation(graph: nx.MultiDiGraph) -> bool:
    """Attach 'elevation' to nodes and 'grade' to edges, in place.

    Returns True if elevation data was successfully attached (fully or
    partially), False if the API was entirely unreachable.
    """
    cache = _load_cache()
    nodes = list(graph.nodes(data=True))
    to_fetch: list[tuple[str, float, float]] = []
    for node_id, data in nodes:
        key = _cache_key(data["y"], data["x"])
        if key in cache:
            data["elevation"] = cache[key]
        else:
            to_fetch.append((node_id, data["y"], data["x"]))

    any_success = any("elevation" in d for _, d in nodes)
    api_ok = True

    for i in range(0, len(to_fetch), BATCH_SIZE):
        batch = to_fetch[i : i + BATCH_SIZE]
        coords = [(lat, lon) for _, lat, lon in batch]
        try:
            elevations = _fetch_batch(coords)
        except (requests.RequestException, ValueError) as exc:
            logger.warning("OpenTopoData request failed (%s); leaving %d nodes without elevation", exc, len(batch))
            api_ok = False
            continue
        for (node_id, lat, lon), elev in zip(batch, elevations):
            if elev is None:
                continue
            graph.nodes[node_id]["elevation"] = elev
            cache[_cache_key(lat, lon)] = elev
            any_success = True
        if i + BATCH_SIZE < len(to_fetch):
            time.sleep(REQUEST_DELAY_S)

    _save_cache(cache)

    grade_count = 0
    for u, v, k, data in graph.edges(keys=True, data=True):
        eu, ev = graph.nodes[u].get("elevation"), graph.nodes[v].get("elevation")
        length = data.get("length", 0)
        if eu is not None and ev is not None and length > 0:
            data["grade"] = abs(ev - eu) / length
            grade_count += 1
        # else: leave 'grade' key absent entirely (GraphML round-trips None poorly)

    logger.info("Attached grade to %d/%d edges", grade_count, graph.number_of_edges())
    success = api_ok and any_success
    graph.graph["elevation_attached"] = success
    return success


if __name__ == "__main__":
    import logging as _logging

    from app.graph.build_graph import build_or_load_graph

    _logging.basicConfig(level=_logging.INFO)
    g = build_or_load_graph()
    ok = attach_elevation(g)
    print("Elevation attached OK" if ok else "Elevation degraded/unavailable")
