import type { LatLon } from "../types"

interface Props {
  defaultLocation: LatLon
  onReportSubmitted: () => void
}

// Full camera capture / location confirm / VLM result card flow lands in phase 4.
export default function ReportScreen({ onReportSubmitted }: Props) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl" aria-hidden>
        📷
      </div>
      <h2 className="text-lg font-bold text-gray-900">Report a hazard</h2>
      <p className="text-gray-600">Photo capture, location confirmation, and the AI hazard verdict are coming soon.</p>
      <button
        onClick={onReportSubmitted}
        className="tap-target rounded-lg border-2 border-gray-300 px-4 text-base font-semibold text-gray-500"
        disabled
      >
        Coming in the next update
      </button>
    </div>
  )
}
