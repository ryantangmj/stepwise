# Stepwise

Community-powered accessible walking routes for people with mobility limits
(wheelchair, walker/rollator, cane) — built for a hackathon on "AI for elderly".
Optimizes for comfortable/safe routes instead of shortest distance, and lets the
community report sidewalk hazards by photo; a vision-language model assesses each
photo and updates the map. Scoped to one Pittsburgh neighborhood (default: Oakland).

**Status: Phase 3 of 6 complete** — full backend (routing, hazard reports, VLM
analysis, decay) plus a mobile-first React/Leaflet frontend: map with route
comparison, colored hazard markers with photo/verdict popups, and a profile
selector. The Report and Profile screens are still stubs (phases 4 and 5).

## Setup

Backend requires Python 3.12 (pinned via `uv`) because OSMnx's geospatial
dependencies (geopandas/shapely/scipy) don't yet ship wheels for newer Pythons.

```bash
cd backend
uv sync
cp .env.example .env   # already done in this checkout; edit if you want a different bbox
```

The pedestrian graph for the configured bbox and its elevation data are already
cached in `app/data/` and committed to git, so first run is fast and works
offline. To rebuild from scratch (e.g. after changing `BBOX_*` in `.env`):

```bash
uv run python -m app.graph.build_graph   # re-downloads from OpenStreetMap
uv run python -m app.graph.elevation     # re-fetches elevation from OpenTopoData
```

## Run

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

## Verify

```bash
cd backend
uv run python -m pytest tests/ -v -s
```

`test_routing.py` asserts the Shortest and Stepwise routes differ for the wheelchair
profile on the demo start/end pair — with the default Oakland bbox, Shortest crosses
a ~24% grade street (Pittsburgh hills) while Stepwise detours to stay under 8%.
`test_reports.py` submits a hazard photo mid-block on the Shortest route and asserts
Stepwise reroutes around it, then exercises confirm/deny (2 denials auto-resolves).

With the server running, you can also exercise the API by hand:

```bash
curl localhost:8000/api/config

# Submit a hazard report (works with no OPENAI_API_KEY when DEMO_MODE=true —
# falls back to a cached/default VLM response)
curl -X POST localhost:8000/api/reports \
  -F "photo=@/path/to/photo.jpg" -F "lat=40.4410" -F "lon=-79.9563"

curl localhost:8000/api/reports

curl -X POST localhost:8000/api/reports/<id>/confirm -H 'Content-Type: application/json' \
  -d '{"still_there": true}'

curl -X POST localhost:8000/api/routes -H 'Content-Type: application/json' -d '{
  "start_lat": 40.4406, "start_lon": -79.9563,
  "end_lat": 40.4443, "end_lon": -79.9553,
  "profile": "wheelchair"
}'
```

Note: the SQLite db (`backend/stepwise.db`) and uploaded photos are gitignored and
created fresh on first run — there's no seed data yet (that's phase 6).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) with the backend
running on `:8000` — Vite's dev server proxies `/api` and `/uploads` to it (see
`vite.config.ts`), so no CORS setup or env var is needed in dev. Load it at a
narrow (~390px) width or in your browser's device toolbar to see the intended
mobile layout. The Map tab is fully functional: profile chips, tap-to-set start
(A) and end (B), Shortest (red dashed) vs Stepwise (teal) routes, a comparison
card, and hazard markers you can tap for the photo/AI verdict and Confirm/Gone
buttons. Report and Profile tabs are placeholders until phases 4 and 5.

## Configuration

All configuration lives in `backend/.env` (see `.env.example`). Key variables:

| Variable | Purpose |
|---|---|
| `BBOX_NORTH/SOUTH/EAST/WEST` | Neighborhood bounding box (default: Oakland, Pittsburgh) |
| `DEMO_START_LAT/LON`, `DEMO_END_LAT/LON` | Demo route endpoints — **placeholders**, replace after scouting the area |
| `OPENAI_API_KEY` | Your OpenAI key (leave blank to run fully in demo-mode fallback) |
| `VLM_MODEL` | Vision-capable model for hazard photo analysis — set to a model your account can access |
| `TEXT_MODEL` | Cheaper/faster text model for profile parsing and route explanations |
| `REPORT_DECAY_DAYS` | Days for a hazard report's confidence to decay to zero (default 14) |
| `DEMO_MODE` | When `true`, all LLM calls fall back to cached/templated responses on failure/timeout/no-key, so the demo never dies on bad wifi |

## Mobility profiles

Defined as data in `backend/app/graph/profiles.py`: `wheelchair`, `walker`, `cane`,
and `custom` (built from free text via `/api/profile/parse`, added in a later phase).

## Non-goals

User accounts/auth, native mobile apps, full-city coverage, payments, offline mode.

**Future work** (out of scope for the hackathon build): 311 auto-reporting
integration for verified hazards; seeding the hazard map from Mapillary or Project
Sidewalk computer-vision data instead of only community reports; scaling beyond a
single neighborhood to more cities.

## Roadmap

1. ✅ Backend skeleton, graph download/cache, elevation, profile-aware routing
2. ✅ Reports storage, snapping, hazard penalties, decay, VLM analysis endpoint
3. ✅ Frontend map, route comparison, hazard markers, profile selector
4. Report flow (camera, location confirm, VLM result card, reroute)
5. Natural-language profile parsing, route explanations, voice input
6. Seed script, reset endpoint, UI polish
