"""Snap a report's lat/lon to the nearest walkable graph edge."""
from __future__ import annotations

import math

import networkx as nx
import osmnx as ox

from app.graph.edge_ids import canonical_edge_id


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def snap_to_edge(graph: nx.MultiDiGraph, lat: float, lon: float) -> str:
    u, v, k = ox.distance.nearest_edges(graph, lon, lat)
    return canonical_edge_id(u, v, k)
