"""Compute Shortest vs Stepwise routes between two points for a mobility profile."""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Callable

import networkx as nx
import osmnx as ox

from app import config
from app.graph.build_graph import build_or_load_graph
from app.graph.elevation import attach_elevation
from app.graph.profiles import MobilityProfile
from app.graph.weights import _edge_grade, _first, edge_cost, shortest_distance_cost

logger = logging.getLogger("stepwise.routing")

# Module-level singleton so the (slow) graph load/elevation pass happens once per process.
_graph: nx.MultiDiGraph | None = None

# (u, v, k) -> extra hazard penalty, wired up by the reports module in phase 2.
HazardPenaltyFn = Callable[[int, int, int], float]


def get_graph() -> nx.MultiDiGraph:
    global _graph
    if _graph is not None:
        return _graph

    graph = build_or_load_graph()
    already_attached = graph.graph.get("elevation_attached") in (True, "True")
    if not already_attached:
        ok = attach_elevation(graph)
        if ok:
            ox.save_graphml(graph, config.GRAPH_CACHE_PATH)
    _graph = graph
    return graph


def reset_graph_cache() -> None:
    """Force the next get_graph() call to reload from disk (used by tests/scripts)."""
    global _graph
    _graph = None


def _min_cost_edge(
    graph: nx.MultiDiGraph, u: int, v: int, cost_fn: Callable[[int, int, int, dict], float]
) -> tuple[int | None, dict | None, float]:
    """Among parallel edges u->v, return the (key, data, cost) of the cheapest one."""
    edges = graph.get_edge_data(u, v)
    best_k, best_data, best_cost = None, None, math.inf
    for k, data in edges.items():
        c = cost_fn(u, v, k, data)
        if c < best_cost:
            best_k, best_data, best_cost = k, data, c
    return best_k, best_data, best_cost


def _weight_factory(cost_fn: Callable[[int, int, int, dict], float]):
    def weight(u: int, v: int, d: dict) -> float:
        return min(cost_fn(u, v, k, data) for k, data in d.items())

    return weight


@dataclass
class RouteResult:
    kind: str  # "shortest" | "stepwise"
    node_ids: list[int]
    coordinates: list[tuple[float, float]]  # (lat, lon), in path order
    distance_m: float
    time_s: float
    max_grade: float | None
    is_fully_accessible: bool  # False if some segment was impassable for the profile
    step_count: int
    edge_ids: list[str] = field(default_factory=list)  # "u_v_k" strings, for hazard matching


def _build_route_result(
    graph: nx.MultiDiGraph,
    kind: str,
    path: list[int],
    cost_fn: Callable[[int, int, int, dict], float],
    profile: MobilityProfile,
) -> RouteResult:
    coordinates = [(graph.nodes[n]["y"], graph.nodes[n]["x"]) for n in path]
    distance = 0.0
    max_grade = None
    is_fully_accessible = True
    step_count = 0
    edge_ids: list[str] = []

    for u, v in zip(path[:-1], path[1:]):
        k, data, cost = _min_cost_edge(graph, u, v, cost_fn)
        if data is None or math.isinf(cost):
            is_fully_accessible = False
            continue
        distance += data.get("length", 0.0) or 0.0
        edge_ids.append(f"{u}_{v}_{k}")
        grade = _edge_grade(data)
        if grade is not None:
            max_grade = grade if max_grade is None else max(max_grade, grade)
        if _first(data.get("highway")) == "steps":
            step_count += 1

    speed = config.WALK_SPEED_MPS.get(profile.name, 0.9)
    time_s = distance / speed if speed > 0 else 0.0
    return RouteResult(
        kind=kind,
        node_ids=path,
        coordinates=coordinates,
        distance_m=distance,
        time_s=time_s,
        max_grade=max_grade,
        is_fully_accessible=is_fully_accessible,
        step_count=step_count,
        edge_ids=edge_ids,
    )


def compute_routes(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    profile: MobilityProfile,
    hazard_penalty_fn: HazardPenaltyFn | None = None,
) -> tuple[RouteResult, RouteResult]:
    """Return (shortest_route, stepwise_route) for the given profile."""
    graph = get_graph()
    hazard_penalty_fn = hazard_penalty_fn or (lambda u, v, k: 0.0)

    orig = ox.distance.nearest_nodes(graph, start_lon, start_lat)
    dest = ox.distance.nearest_nodes(graph, end_lon, end_lat)

    def shortest_cost(u: int, v: int, k: int, data: dict) -> float:
        return shortest_distance_cost(u, v, data)

    def stepwise_cost(u: int, v: int, k: int, data: dict) -> float:
        return edge_cost(u, v, data, profile, hazard_penalty=hazard_penalty_fn(u, v, k))

    shortest_path = nx.shortest_path(graph, orig, dest, weight=_weight_factory(shortest_cost))
    stepwise_path = nx.shortest_path(graph, orig, dest, weight=_weight_factory(stepwise_cost))

    shortest_result = _build_route_result(graph, "shortest", shortest_path, shortest_cost, profile)
    stepwise_result = _build_route_result(graph, "stepwise", stepwise_path, stepwise_cost, profile)
    return shortest_result, stepwise_result
