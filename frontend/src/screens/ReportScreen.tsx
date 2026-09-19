import type { Marker as LeafletMarker } from "leaflet"
import { useEffect, useRef, useState } from "react"
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet"
import { createReport } from "../api"
import { REPORT_PIN_ICON } from "../mapIcons"
import { HAZARD_TYPE_LABEL, PASSABILITY_STYLE, SEVERITY_COLOR, SEVERITY_LABEL } from "../profiles"
import type { LatLon, ReportOut } from "../types"

interface Props {
  defaultLocation: LatLon
  onReportSubmitted: () => void
}

type Step = "capture" | "confirm" | "result"

function LocationClickHandler({ onPick }: { onPick: (p: LatLon) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng })
    },
  })
  return null
}

export default function ReportScreen({ defaultLocation, onReportSubmitted }: Props) {
  const [step, setStep] = useState<Step>("capture")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [location, setLocation] = useState<LatLon>(defaultLocation)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<ReportOut | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
    setSubmitError(null)

    // Progressive enhancement: prefill from the device's real location, but
    // don't block on it — a desktop demo without geolocation just keeps the
    // default (the current map start point) for the user to drag/tap-correct.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      )
    }
    setStep("confirm")
  }

  function reset() {
    setStep("capture")
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setNote("")
    setResult(null)
    setSubmitError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit() {
    if (!photoFile) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const r = await createReport({ photo: photoFile, lat: location.lat, lon: location.lon, note: note || undefined })
      setResult(r)
      setStep("result")
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong submitting your report")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto h-full max-w-md overflow-y-auto p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {step === "capture" && (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <div className="text-5xl" aria-hidden>
            📷
          </div>
          <h2 className="text-lg font-bold text-gray-900">Report a hazard</h2>
          <p className="text-gray-600">
            Take a photo of the sidewalk or path issue. Our AI will assess it and update the map.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="tap-target rounded-lg bg-teal-700 px-6 text-lg font-semibold text-white"
          >
            📷 Take a photo
          </button>
        </div>
      )}

      {step === "confirm" && photoPreviewUrl && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Confirm the location</h2>
          <img src={photoPreviewUrl} alt="Hazard preview" className="h-40 w-full rounded-lg object-cover" />

          <p className="text-sm text-gray-600">Drag the pin or tap the map to correct the spot.</p>
          <div className="h-56 overflow-hidden rounded-lg border-2 border-gray-300">
            <MapContainer center={[location.lat, location.lon]} zoom={18} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationClickHandler onPick={setLocation} />
              <Marker
                position={[location.lat, location.lon]}
                icon={REPORT_PIN_ICON}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target as LeafletMarker
                    const { lat, lng } = marker.getLatLng()
                    setLocation({ lat, lon: lng })
                  },
                }}
              />
            </MapContainer>
          </div>

          <label className="block text-sm font-semibold text-gray-700">
            Note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else worth mentioning?"
              className="mt-1 w-full rounded-lg border-2 border-gray-300 p-2 text-base"
              rows={2}
            />
          </label>

          {submitError && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{submitError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              className="tap-target flex-1 rounded-lg border-2 border-gray-300 text-base font-semibold text-gray-700"
              disabled={submitting}
            >
              Choose another photo
            </button>
            <button
              onClick={handleSubmit}
              className="tap-target flex-1 rounded-lg bg-teal-700 text-base font-semibold text-white disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Analyzing…" : "Submit report"}
            </button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Here's what our AI found</h2>

          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: SEVERITY_COLOR[result.severity] ?? "#d97706" }}
            >
              {SEVERITY_LABEL[result.severity] ?? "Unknown"} severity
            </span>
            {result.used_fallback && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">demo cache</span>
            )}
          </div>

          <div className="rounded-lg bg-gray-100 p-3">
            <div className="font-semibold text-gray-900">{HAZARD_TYPE_LABEL[result.hazard_type] ?? result.hazard_type}</div>
            <div className="mt-1 text-gray-700">{result.reason}</div>
            <div className="mt-2 text-sm text-gray-500">Confidence: {Math.round(result.confidence * 100)}%</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">Passability by mobility type</div>
            <div className="grid grid-cols-3 gap-2">
              {(["wheelchair", "walker", "cane"] as const).map((k) => {
                const style = PASSABILITY_STYLE[result.passability[k]]
                return (
                  <div key={k} className={`rounded-lg p-2 text-center ${style.bg} ${style.text}`}>
                    <div className="text-xs font-semibold capitalize">{k}</div>
                    <div className="text-sm">
                      {style.icon} {style.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {result.needs_better_photo && result.follow_up_question && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold">Could you help us confirm?</div>
              <div className="mt-1">{result.follow_up_question}</div>
            </div>
          )}

          <button
            onClick={onReportSubmitted}
            className="tap-target w-full rounded-lg bg-teal-700 text-base font-semibold text-white"
          >
            ✓ Route updated — back to map
          </button>
          <button
            onClick={reset}
            className="tap-target w-full rounded-lg border-2 border-gray-300 text-base font-semibold text-gray-700"
          >
            Report another hazard
          </button>
        </div>
      )}
    </div>
  )
}
