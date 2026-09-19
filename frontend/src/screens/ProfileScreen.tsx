import { PROFILE_PRESETS } from "../profiles"
import type { ProfileName } from "../types"

interface Props {
  profile: ProfileName
  onProfileChange: (p: ProfileName) => void
}

const PROFILE_DESCRIPTIONS: Record<ProfileName, string> = {
  wheelchair:
    "Avoids steps entirely, requires curb cuts at crossings, and keeps hills gentle (comfortable up to about 5%, hard limit 8%).",
  walker:
    "Avoids steps entirely, prefers routes with places to rest, and tolerates slightly steeper hills than a wheelchair profile (comfortable up to about 6%, hard limit 10%).",
  cane: "Steps are allowed but penalized in favor of ramps, and hills up to about 12% are tolerated.",
  custom: "Built from your own description of your needs.",
}

export default function ProfileScreen({ profile, onProfileChange }: Props) {
  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h2 className="text-lg font-bold text-gray-900">Your mobility profile</h2>
      <p className="text-gray-600">
        Stepwise uses this to choose routes that stay comfortable for you — avoiding steps, steep hills, and known
        hazards when it can.
      </p>

      <div className="space-y-2">
        {PROFILE_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onProfileChange(p.name)}
            className={`tap-target w-full rounded-lg border-2 p-3 text-left ${
              profile === p.name ? "border-teal-700 bg-teal-50" : "border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden>{p.icon}</span>
              {p.label}
            </div>
            <div className="mt-1 text-sm text-gray-600">{PROFILE_DESCRIPTIONS[p.name]}</div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500">
        Describing your needs in your own words (with optional voice input) is coming soon — for now, pick the
        closest preset above.
      </div>
    </div>
  )
}
