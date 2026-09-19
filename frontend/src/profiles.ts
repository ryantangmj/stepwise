import type { ProfileName } from "./types"

export const PROFILE_PRESETS: { name: ProfileName; label: string; icon: string }[] = [
  { name: "wheelchair", label: "Wheelchair", icon: "♿" },
  { name: "walker", label: "Walker", icon: "🚶" },
  { name: "cane", label: "Cane", icon: "🦯" },
]

export const SEVERITY_COLOR: Record<number, string> = {
  1: "#16a34a",
  2: "#65a30d",
  3: "#d97706",
  4: "#ea580c",
  5: "#dc2626",
}

export const SEVERITY_LABEL: Record<number, string> = {
  1: "Minor",
  2: "Minor",
  3: "Moderate",
  4: "Serious",
  5: "Severe",
}

export const HAZARD_TYPE_LABEL: Record<string, string> = {
  crack: "Cracked surface",
  heave: "Raised/uneven slab",
  missing_curb_cut: "Missing curb cut",
  steep_ramp: "Steep ramp",
  obstruction: "Obstruction",
  standing_water: "Standing water",
  broken_surface: "Broken surface",
  stairs_only: "Stairs only",
  construction: "Construction",
  none: "Unspecified",
}
