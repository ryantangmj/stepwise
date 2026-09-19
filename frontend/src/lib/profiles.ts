import { Accessibility, Activity, Focus, CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';
import type { ProfileName } from "./types";

export const PROFILE_PRESETS: { name: ProfileName; label: string; icon: any }[] = [
  { name: "wheelchair", label: "Wheelchair", icon: Accessibility },
  { name: "walker", label: "Walker", icon: Activity },
  { name: "cane", label: "Cane", icon: Focus },
];

export const SEVERITY_COLOR: Record<number, string> = {
  1: "#16a34a",
  2: "#65a30d",
  3: "#d97706",
  4: "#ea580c",
  5: "#dc2626",
};

export const SEVERITY_LABEL: Record<number, string> = {
  1: "Minor",
  2: "Minor",
  3: "Moderate",
  4: "Serious",
  5: "Severe",
};

export const PASSABILITY_STYLE: Record<string, { bg: string; text: string; label: string; Icon: any }> = {
  passable: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-400", label: "Passable", Icon: CheckCircle2 },
  difficult: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-400", label: "Difficult", Icon: AlertTriangle },
  impassable: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-400", label: "Impassable", Icon: XOctagon },
};

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
  none: "Unspecified hazard",
};