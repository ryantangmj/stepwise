# Stepwise — CLAUDE.md

Hackathon project: accessible pedestrian routing for wheelchair/walker/cane users
("Waze for sidewalks"), scoped to one Pittsburgh neighborhood (default: Oakland).

## Stack
- **Backend:** Python 3.12 (pinned via `uv`), FastAPI, OSMnx + NetworkX for routing,
  SQLite (SQLAlchemy) for reports, OpenAI SDK for VLM hazard analysis + text LLM calls.
- **Frontend:** React + Vite + TypeScript, Tailwind, Leaflet + OSM raster tiles.
- **No external routing API** — the pedestrian graph is downloaded once via OSMnx and
  cached to `backend/app/data/graph.graphml`; all routing uses custom edge-cost weights
  over that graph with NetworkX. Elevation comes from the OpenTopoData public API,
  cached to `backend/app/data/elevation_cache.json`, with graceful degradation if
  unreachable (routes still work, just without slope penalties).

## Commands
```bash
# Backend
cd backend
uv sync                                  # install deps (Python 3.12 pinned via .python-version)
uv run uvicorn app.main:app --reload --port 8000
uv run python -m pytest tests/ -v -s
uv run python -m app.graph.build_graph   # force-rebuild the OSM graph cache
uv run python -m app.graph.elevation     # (re)attach elevation to the cached graph

# Frontend (added in phase 3)
cd frontend
npm install
npm run dev
```

## Conventions
- All config lives in `backend/app/config.py`, sourced from `backend/.env` (see
  `.env.example`). Never hardcode the bbox, demo coordinates, or model names elsewhere.
- Mobility profiles are data (`app/graph/profiles.py`), not branching logic — the edge
  cost function in `app/graph/weights.py` reads profile fields generically so a new
  profile (including LLM-parsed custom ones) needs no code changes.
- All OpenAI calls go through `app/llm.py` (added in phase 2) so the provider/model can
  be swapped in one place. Structured outputs use Pydantic + the SDK's `.parse()` helper.
- `DEMO_MODE=true` must keep the whole app working even with no network / no API key:
  every LLM call site needs a cached or templated fallback. Don't add a new AI feature
  without also adding its demo-mode fallback.
- The graph is a module-level singleton (`app/graph/routing.py: get_graph()`) loaded
  once per process — don't reload it per-request.
- `app/data/graph.graphml` and `app/data/elevation_cache.json` ARE committed to git
  (precomputed cache, per the brief) — `backend/cache/` (raw Overpass responses) is
  gitignored since it's redundant with the graphml cache.
- Keep edge-cost, decay, and snapping logic commented on the *why*, not the *what* —
  these are the least obvious parts of the codebase.
- This is a hackathon build: prefer simple, readable, working code over abstraction.
  Don't add auth, migrations frameworks, or config for scenarios out of scope (see
  README non-goals).

## Phases (see README for detailed status)
1. Backend skeleton, graph download/cache, elevation, profile-aware routing — DONE
2. Reports storage, snapping, hazard penalties, decay, VLM analysis endpoint
3. Frontend map, route comparison, hazard markers, profile selector
4. Report flow (camera, location confirm, VLM result card, reroute)
5. Natural-language profile parsing, route explanations, voice input
6. Seed script, reset endpoint, README polish, UI polish
