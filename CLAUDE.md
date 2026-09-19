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

# Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api and /uploads to :8000 (see vite.config.ts)
npx tsc -b --noEmit
npm run lint
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
2. Reports storage, snapping, hazard penalties, decay, VLM analysis endpoint — DONE
   (route explanations via `app/llm.py` also landed here, ahead of phase 5)
3. Frontend map, route comparison, hazard markers, profile selector — DONE
   (Profile screen is still a stub pending phase 5)
4. Report flow (camera, location confirm, VLM result card, reroute) — DONE
5. Natural-language profile parsing, voice input — DONE
6. Seed script, reset endpoint, README polish, UI polish — DONE

## Demo seed data (phase 6)
- `app/seed.py: seed_demo_reports(db)` is the single source of truth — it
  clears all reports + uploaded photos and reloads from
  `backend/seed_photos/seed_reports.json`. Both `scripts/seed_demo.py` (CLI)
  and `POST /api/demo/reset` (API) just call it; `app/main.py` also calls it
  once at startup when `DEMO_MODE=true` and the reports table is empty, so a
  clean checkout has something to show without a manual step.
- The 4 seeded hazards' coordinates were deliberately picked from real
  mid-block points along the *actual* computed Shortest route for the default
  Oakland demo pair (see the `compute_routes(...)` node-enumeration snippet
  in git history / phase 6 commit if you need to redo this for a new bbox or
  demo pair) — that's what makes the Shortest-route-hits-hazards /
  Stepwise-route-avoids-them contrast show up immediately on first load
  rather than needing a manually-placed report first.
- If you change `DEMO_START`/`DEMO_END` or `BBOX_*`, the seed coordinates
  will no longer sit on the new route — recompute them the same way (get the
  Shortest route's `node_ids`, take mid-block points between consecutive
  nodes) and update `seed_reports.json`.
- Missing photo files listed in `seed_reports.json` are auto-generated as
  simple labeled placeholder JPEGs (`app/seed.py: _generate_placeholder_photo`)
  — replace them with real photos any time by dropping a file with the same
  name into `seed_photos/`.

## Custom profiles (phase 5)
- `POST /api/profile/parse` (`app/routers/profile.py`) calls `llm.parse_profile_text`,
  builds a `MobilityProfile` via `profiles.custom_profile_from_fields`, and
  stores it in an **in-memory** `dict[profile_id, MobilityProfile]` — no DB
  table, since there are no user accounts to persist it against. A server
  restart loses custom profiles; that's fine here, the user just re-describes
  their needs. `POST /api/routes` looks the profile up by `custom_profile_id`
  when `profile == "custom"` and 404s with a friendly message if it's gone.
- Frontend: `ProfileScreen` posts free text (+ optional Web Speech API voice
  input, feature-detected — the mic button simply doesn't render without
  browser support) to `/api/profile/parse`, shows the returned plain-language
  `summary` for confirmation, and only switches the active profile to
  `"custom"` once the user taps "Looks right." `App.tsx` holds
  `customProfileId`/`customProfileSummary` alongside `profile` and clears
  them whenever a preset chip is tapped instead.

## Frontend notes (phase 3)
- No router library — `App.tsx` holds a simple `tab` state and lifts shared
  state (profile, start/end points) as props into the three screens. Fine at
  this scope; don't reach for react-router unless the app outgrows 3 screens.
- Leaflet gotchas hit and fixed in `screens/MapScreen.tsx` — worth knowing
  before touching the map:
  - **`map.invalidateSize()`**: the map mounts before the route-comparison
    card below it has content, so the flex-computed map height changes once
    the first route response arrives. Leaflet caches container size at
    mount and won't notice that on its own — uncorrected, markers render
    using the stale (taller) size and land outside the actual visible/clipped
    area. `FitToRoute` calls `invalidateSize()` before every `fitBounds()`.
  - **Pane z-order**: hazard `CircleMarker`s and route `Polyline`s both live
    in Leaflet's default overlay pane, and paint order there follows DOM
    *mount* order — not JSX order — so whichever of the reports-fetch or
    routes-fetch effect resolves first determines whether hazards render
    above or below the route lines. Put hazards in their own `<Pane
    zIndex={450}>` (above the default overlay pane's 400, below the marker
    pane's 600) so they're always tappable regardless of fetch timing.
  - Start/End markers use `L.divIcon` rather than the default `L.Icon` —
    Leaflet's default marker images don't resolve correctly through Vite's
    bundler without extra config, and divIcon sidesteps that entirely.
- Verified with a scripted Playwright pass (headless Chromium at a 390px
  mobile viewport) rather than just visual inspection — that's how both
  Leaflet issues above were actually caught.
- Known harmless console warning: occasionally, right around a draggable
  `Marker`'s host component unmounting (e.g. leaving the Report screen),
  Leaflet logs `TypeError: Cannot read properties of undefined (reading
  '_leaflet_pos')`. This is an intermittent Leaflet/react-leaflet internal
  cleanup race (a stale DOM reference in `L.Draggable`'s teardown), not
  reproducible on demand, and doesn't affect app behavior — confirmed via
  repeated scripted runs where the full flow completed correctly whether or
  not the warning fired. Not worth chasing further; mentioning here so a
  future session doesn't mistake it for a real regression.

## Report flow (phase 4)
`screens/ReportScreen.tsx` is a 3-step wizard (`capture` → `confirm` →
`result`), no routing library needed:
- **capture**: a hidden `<input type=file accept=image/* capture=environment>`
  triggered by a big button — this is what actually opens the phone camera.
- **confirm**: photo preview, a small map with a draggable `Marker` *and* a
  map-click handler both updating the same `location` state (draggable pin +
  tap-to-place fallback, per the brief, on the same widget rather than two
  separate UIs). `navigator.geolocation` prefills the pin but is best-effort
  and non-blocking — no geolocation support/permission just leaves the
  default (the map's current start point) for the user to correct manually.
- **result**: renders the VLM verdict — severity badge, hazard type, reason,
  per-profile passability (icon + label + color, never color alone),
  confidence, a follow-up-question callout when `needs_better_photo` is true,
  and a "demo cache" badge when `used_fallback` is true. "Route updated" hands
  control back to `App.tsx` (bumps `reportsVersion`, switches to the Map tab).

## Notes on edge cases (phase 2)
- Hazard reports snap to the nearest *edge* (`app/reports/snapping.py`); routes
  are built from nearest *node* to nearest *node*. At an intersection with
  several edges meeting at almost the same point, a hazard reported right at
  the junction can snap to a different edge than the one the route actually
  traverses through that node. This only matters within a few meters of a
  junction — a hazard reported mid-block (the realistic case, and what the
  demo script places) snaps unambiguously to the edge the route uses.
- `snapped_edge_id` is a canonical *undirected* `"u_v_k"` id
  (`app/graph/edge_ids.py: canonical_edge_id`) so a hazard blocks a segment in
  both directions regardless of which directed edge nearest_edges/routing picked.
