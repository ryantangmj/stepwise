export type ProfileName = "wheelchair" | "walker" | "cane" | "custom";
export type PassabilityLevel = "passable" | "difficult" | "impassable";
export type HazardType = "crack" | "heave" | "missing_curb_cut" | "steep_ramp" | "obstruction" | "standing_water" | "broken_surface" | "stairs_only" | "construction" | "none";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface ConfigResponse {
  bbox: { north: number; south: number; east: number; west: number };
  demo_start: LatLon;
  demo_end: LatLon;
  demo_mode: boolean;
}

export interface RouteStats {
  kind: "shortest" | "stepwise";
  distance_m: number;
  time_s: number;
  max_grade: number | null;
  is_fully_accessible: boolean;
  step_count: number;
  coordinates: [number, number][];
  hazards_nearby: string[];
}

export interface RouteResponse {
  shortest: RouteStats;
  stepwise: RouteStats;
  explanation: string;
  explanation_is_fallback: boolean;
}

export interface Passability {
  wheelchair: PassabilityLevel;
  walker: PassabilityLevel;
  cane: PassabilityLevel;
}

export interface ProfileParseResponse {
  profile_id: string;
  base_profile: "wheelchair" | "walker" | "cane";
  max_comfortable_grade: number | null;
  hard_max_grade: number | null;
  max_continuous_walk_m: number | null;
  avoid_uncontrolled_crossings: boolean;
  prefer_rest_points: boolean;
  notes: string;
  summary: string;
  is_fallback: boolean;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
}

export interface ReportOut {
  id: string;
  lat: number;
  lon: number;
  photo_url: string;
  hazard_type: HazardType;
  severity: number;
  passability: Passability;
  confidence: number;
  estimated_level_change_cm: number | null;
  needs_better_photo: boolean;
  follow_up_question: string | null;
  reason: string;
  status: "active" | "resolved" | "expired";
  confirmations: number;
  denials: number;
  created_at: string;
  last_confirmed_at: string;
  used_fallback: boolean;
}