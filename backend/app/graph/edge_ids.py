def canonical_edge_id(u: int, v: int, k: int) -> str:
    """Undirected id for a physical edge, so a hazard snapped to it blocks
    travel in both directions regardless of which direction routing/nearest_edges picked."""
    lo, hi = min(u, v), max(u, v)
    return f"{lo}_{hi}_{k}"
