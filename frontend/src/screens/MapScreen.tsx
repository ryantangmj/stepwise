import L from "leaflet"
import { useEffect, useMemo, useState } from "react"
import { CircleMarker, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet"
import { confirmReport, getReports, postRoutes } from "../api"
import { HAZARD_TYPE_LABEL, PROFILE_PRESETS, SEVERITY_COLOR, SEVERITY_LABEL } from "../profiles"
import type { ConfigResponse, LatLon, ProfileName, ReportOut, RouteResponse } from "../types"

interface Props {
  config: ConfigResponse
  profile: ProfileName
  onProfileChange: (p: ProfileName) => void
  start: LatLon
  end: LatLon
  onStartChange: (p: LatLon) => void
  onEndChange: (p: LatLon) => void
  reportsVersion: number
  onReportsChanged: () => void
}

function pinIcon(label: string, bg: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"><span style="transform:rotate(45deg);font-size:15px;line-height:1">${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  })
}

const START_ICON = pinIcon("A", "#0f766e")
const END_ICON = pinIcon("B", "#1d4ed8")

function MapClickHandler({ onMapClick }: { onMapClick: (p: LatLon) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng })
    },
  })
  return null
}

function FitToRoute({ start, end, routeData }: { start: LatLon; end: LatLon; routeData: RouteResponse | null }) {
  const map = useMap()
  useEffect(() => {
    // The map mounts before the route-comparison card below it has real
    // content, so its flex-computed height changes once routeData first
    // arrives; Leaflet doesn't detect that on its own and, uncorrected,
    // places markers using its stale (taller) cached size — which then
    // renders below the now-shorter visible/clipped map area.
    map.invalidateSize()
    const points: [number, number][] = [
      [start.lat, start.lon],
      [end.lat, end.lon],
      ...(routeData?.shortest.coordinates ?? []),
      ...(routeData?.stepwise.coordinates ?? []),
    ]
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, routeData])
  return null
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function formatTime(s: number): string {
  const min = Math.round(s / 60)
  return min < 1 ? "<1 min" : `${min} min`
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso + "Z").getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days >= 1) return `${days}d ago`
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours >= 1) return `${hours}h ago`
  const mins = Math.max(1, Math.floor(diffMs / 60_000))
  return `${mins}m ago`
}

export default function MapScreen({
  config,
  profile,
  onProfileChange,
  start,
  end,
  onStartChange,
  onEndChange,
  reportsVersion,
  onReportsChanged,
}: Props) {
  const [pickMode, setPickMode] = useState<"start" | "end" | null>(null)
  const [routeData, setRouteData] = useState<RouteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<ReportOut[]>([])

  const center = useMemo<[number, number]>(
    () => [(config.bbox.north + config.bbox.south) / 2, (config.bbox.east + config.bbox.west) / 2],
    [config],
  )
  const bounds = useMemo<[[number, number], [number, number]]>(
    () => [
      [config.bbox.south, config.bbox.west],
      [config.bbox.north, config.bbox.east],
    ],
    [config],
  )

  useEffect(() => {
    getReports().then(setReports).catch(() => setReports([]))
  }, [reportsVersion])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    postRoutes({ start_lat: start.lat, start_lon: start.lon, end_lat: end.lat, end_lon: end.lon, profile })
      .then((data) => {
        if (!cancelled) setRouteData(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Could not compute a route")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [start, end, profile, reportsVersion])

  function handleMapClick(p: LatLon) {
    if (pickMode === "start") {
      onStartChange(p)
      setPickMode(null)
    } else if (pickMode === "end") {
      onEndChange(p)
      setPickMode(null)
    }
  }

  async function handleConfirm(id: string, stillThere: boolean) {
    await confirmReport(id, stillThere)
    onReportsChanged()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2">
        {PROFILE_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onProfileChange(p.name)}
            className={`tap-target flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 text-base font-semibold ${
              profile === p.name
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            <span aria-hidden>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 bg-white px-3 pb-2">
        <button
          onClick={() => setPickMode(pickMode === "start" ? null : "start")}
          className={`tap-target flex-1 rounded-lg border-2 text-base font-semibold ${
            pickMode === "start" ? "border-teal-700 bg-teal-50 text-teal-800" : "border-gray-300 text-gray-700"
          }`}
        >
          {pickMode === "start" ? "Tap map to set start…" : "📍 Set start (A)"}
        </button>
        <button
          onClick={() => setPickMode(pickMode === "end" ? null : "end")}
          className={`tap-target flex-1 rounded-lg border-2 text-base font-semibold ${
            pickMode === "end" ? "border-blue-700 bg-blue-50 text-blue-800" : "border-gray-300 text-gray-700"
          }`}
        >
          {pickMode === "end" ? "Tap map to set end…" : "🏁 Set end (B)"}
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <MapContainer center={center} zoom={16} maxBounds={bounds} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <FitToRoute start={start} end={end} routeData={routeData} />

          {routeData && (
            <Polyline
              positions={routeData.shortest.coordinates}
              pathOptions={{ color: "#b91c1c", weight: 5, dashArray: "6 8" }}
            />
          )}
          {routeData && (
            <Polyline positions={routeData.stepwise.coordinates} pathOptions={{ color: "#0f766e", weight: 6 }} />
          )}

          <Marker position={[start.lat, start.lon]} icon={START_ICON} />
          <Marker position={[end.lat, end.lon]} icon={END_ICON} />

          {/* Own pane (above the route-line overlay pane, below the start/end
              marker pane) so hazard markers are always tappable regardless of
              whether routes or reports happen to finish fetching first. */}
          <Pane name="hazards" style={{ zIndex: 450 }}>
            {reports.map((r) => (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lon]}
                radius={10}
                pathOptions={{
                  color: "white",
                  weight: 2,
                  fillColor: SEVERITY_COLOR[r.severity] ?? "#d97706",
                  fillOpacity: 0.95,
                }}
              >
                <Popup>
                  <div className="w-56 space-y-1.5 text-sm">
                    <img src={r.photo_url} alt={r.hazard_type} className="h-28 w-full rounded object-cover" />
                    <div className="font-semibold">
                      {HAZARD_TYPE_LABEL[r.hazard_type] ?? r.hazard_type} · {SEVERITY_LABEL[r.severity] ?? "?"}
                    </div>
                    <div className="text-gray-600">{r.reason}</div>
                    <div className="text-xs text-gray-500">
                      Confidence {Math.round(r.confidence * 100)}% · reported {timeAgo(r.created_at)}
                      {r.used_fallback && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">demo cache</span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleConfirm(r.id, true)}
                        className="tap-target flex-1 rounded bg-teal-700 px-2 text-white"
                      >
                        Still there
                      </button>
                      <button
                        onClick={() => handleConfirm(r.id, false)}
                        className="tap-target flex-1 rounded border border-gray-400 px-2"
                      >
                        Gone
                      </button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </Pane>
        </MapContainer>
      </div>

      <div className="max-h-[42%] overflow-y-auto border-t border-gray-200 bg-white p-3">
        {loading && <p className="text-gray-500">Finding routes…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {routeData && !loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border-2 border-gray-300 p-3">
                <div className="text-sm font-semibold text-gray-500">Shortest</div>
                <div className="text-lg font-bold">{formatDistance(routeData.shortest.distance_m)}</div>
                <div className="text-sm text-gray-600">{formatTime(routeData.shortest.time_s)}</div>
                <div className="mt-1 text-sm text-red-700">
                  {routeData.shortest.hazards_nearby.length > 0
                    ? `⚠ ${routeData.shortest.hazards_nearby.length} hazard(s)`
                    : "No known hazards"}
                </div>
              </div>
              <div className="rounded-lg border-2 border-teal-700 bg-teal-50 p-3">
                <div className="text-sm font-semibold text-teal-800">Stepwise</div>
                <div className="text-lg font-bold">{formatDistance(routeData.stepwise.distance_m)}</div>
                <div className="text-sm text-gray-600">{formatTime(routeData.stepwise.time_s)}</div>
                <div className="mt-1 text-sm text-teal-700">
                  {routeData.stepwise.hazards_nearby.length > 0
                    ? `⚠ ${routeData.stepwise.hazards_nearby.length} hazard(s)`
                    : "No known hazards"}
                </div>
              </div>
            </div>

            {!routeData.stepwise.is_fully_accessible && (
              <p className="rounded bg-red-50 p-2 text-sm text-red-700">
                No fully accessible route was found for this profile between these points — the Stepwise route shown
                includes at least one difficult segment.
              </p>
            )}

            <div className="rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
              {routeData.explanation}
              {routeData.explanation_is_fallback && (
                <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">demo cache</span>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Stepwise is a decision aid based on community reports and estimates. Conditions may differ.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
