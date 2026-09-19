"""Download (or load cached) the pedestrian network for the configured bbox."""
from __future__ import annotations

import logging

import networkx as nx
import osmnx as ox

from app import config

logger = logging.getLogger("stepwise.graph")

# Tags we rely on for accessibility-aware edge costs, beyond osmnx's defaults.
ox.settings.useful_tags_way = list(
    set(ox.settings.useful_tags_way)
    | {"surface", "smoothness", "incline", "kerb", "crossing", "footway", "wheelchair"}
)
ox.settings.useful_tags_node = list(set(ox.settings.useful_tags_node) | {"kerb", "crossing"})


def build_or_load_graph(force_rebuild: bool = False) -> nx.MultiDiGraph:
    """Load the cached GraphML if present, otherwise download from OSM and cache it."""
    if config.GRAPH_CACHE_PATH.exists() and not force_rebuild:
        logger.info("Loading cached graph from %s", config.GRAPH_CACHE_PATH)
        return ox.load_graphml(config.GRAPH_CACHE_PATH)

    logger.info("Downloading pedestrian network for bbox %s", config.BBOX_OSMNX)
    graph = ox.graph_from_bbox(config.BBOX_OSMNX, network_type="walk", simplify=True)
    ox.save_graphml(graph, config.GRAPH_CACHE_PATH)
    logger.info("Cached graph to %s (%d nodes, %d edges)", config.GRAPH_CACHE_PATH, graph.number_of_nodes(), graph.number_of_edges())
    return graph


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    g = build_or_load_graph(force_rebuild=True)
    print(f"Graph: {g.number_of_nodes()} nodes, {g.number_of_edges()} edges")
