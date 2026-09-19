import type { ConfigResponse, GeocodeResult, ProfileName, ProfileParseResponse, ReportOut, RouteResponse } from "./types"

const mockDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function getConfig(): Promise<ConfigResponse> {
  return {
    bbox: { north: 40.455, south: 40.425, east: -79.935, west: -79.975 },
    demo_start: { lat: 40.4345455, lon: -79.9618173 },
    demo_end: { lat: 40.4441762, lon: -79.9455511 },
    demo_mode: true
  };
}

export async function postRoutes(params: {
  start_lat: number; start_lon: number; end_lat: number; end_lon: number;
  profile: ProfileName; custom_profile_id?: string | null;
}): Promise<RouteResponse> {
  await mockDelay(350);
  const { start_lat, start_lon, end_lat, end_lon } = params;
  const latDelta = end_lat - start_lat;
  const lonDelta = end_lon - start_lon;
  const directDistance = haversineDistanceM(start_lat, start_lon, end_lat, end_lon);
  const hazardLat = start_lat + (end_lat - start_lat) * 0.55;
  const hazardLon = start_lon + (end_lon - start_lon) * 0.55;
  const routeHazard = mockReports.find(report => report.id === "r1");
  if (routeHazard) {
    routeHazard.lat = hazardLat;
    routeHazard.lon = hazardLon;
  }
  return {
    shortest: {
      kind: "shortest", distance_m: directDistance, time_s: directDistance / 1.2, max_grade: 8, is_fully_accessible: false, step_count: 5,
      coordinates: [[start_lat, start_lon], [hazardLat, hazardLon], [end_lat, end_lon]],
      hazards_nearby: ["r1"]
    },
    stepwise: {
      kind: "stepwise", distance_m: directDistance * 1.16, time_s: (directDistance * 1.16) / 1.15, max_grade: 4, is_fully_accessible: true, step_count: 0,
      coordinates: [
        [start_lat, start_lon],
        [start_lat + latDelta * 0.32 + lonDelta * 0.12, start_lon + lonDelta * 0.32 - latDelta * 0.12],
        [start_lat + latDelta * 0.7 + lonDelta * 0.12, start_lon + lonDelta * 0.7 - latDelta * 0.12],
        [end_lat, end_lon]
      ],
      hazards_nearby: []
    },
    explanation: "Stepwise avoided a steep ramp and a set of stairs on the shortest route. It's slightly longer but keeps the grade below your comfortable limit.",
    explanation_is_fallback: true
  };
}

let mockReports: ReportOut[] = [
  {
    id: "r1", lat: 40.4398424, lon: -79.9528709, 
    photo_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='%23e5e7eb'%3E%3Crect width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%239ca3af'%3EHazard%3C/text%3E%3C/svg%3E",
    hazard_type: "steep_ramp", severity: 4, passability: { wheelchair: "difficult", walker: "passable", cane: "passable" },
    confidence: 0.9, estimated_level_change_cm: 10, needs_better_photo: false, follow_up_question: null, reason: "Detected a curb cut that exceeds ADA grade guidelines.",
    status: "active", confirmations: 1, denials: 0, created_at: new Date().toISOString(), last_confirmed_at: new Date().toISOString(), used_fallback: true
  }
];

export async function getReports(): Promise<ReportOut[]> {
  return [...mockReports];
}

export async function createReport(params: {
  photo: Blob; lat: number; lon: number; note?: string;
}): Promise<ReportOut> {
  await mockDelay(700);
  const newReport: ReportOut = {
    ...mockReports[0], 
    id: "r" + Date.now(), 
    lat: params.lat, lon: params.lon, 
    photo_url: URL.createObjectURL(params.photo),
    hazard_type: "obstruction", severity: 3, 
    reason: params.note || "Detected temporary obstruction blocking the path."
  };
  mockReports.push(newReport);
  return newReport;
}

export async function confirmReport(id: string, stillThere: boolean): Promise<ReportOut> {
  const match = mockReports.find(r => r.id === id);
  if(match && !stillThere) {
    mockReports = mockReports.filter(r => r.id !== id);
  }
  return match!;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`);
    if(r.ok) {
      const data = await r.json();
      const results = (data.features ?? []).map((feature: {
        geometry: { coordinates: [number, number] };
        properties: {
          name?: string;
          street?: string;
          housenumber?: string;
          city?: string;
          state?: string;
          country?: string;
        };
      }) => {
        const { properties, geometry } = feature;
        const primary = properties.name
          ?? [properties.housenumber, properties.street].filter(Boolean).join(" ");
        const context = [properties.city, properties.state, properties.country]
          .filter(Boolean)
          .join(", ");
        return {
          lat: geometry.coordinates[1],
          lon: geometry.coordinates[0],
          display_name: [primary, context].filter(Boolean).join(" — "),
        };
      });
      if(results.length > 0) return results;
    }
  } catch {
    // The curated fallback below keeps type-ahead useful when offline.
  }
  
  // Graceful fallback
  const lower = query.toLowerCase();
  const fallbacks: GeocodeResult[] = [
    { lat: 40.4345455, lon: -79.9618173, display_name: "Ophelia Street — Pittsburgh, Pennsylvania" },
    { lat: 40.4441762, lon: -79.9455511, display_name: "Hamburg Hall — Pittsburgh, Pennsylvania" },
    { lat: 40.4433266, lon: -79.9435839, display_name: "Carnegie Mellon University — Pittsburgh, Pennsylvania" },
    { lat: 40.4406248, lon: -79.9958864, display_name: "Downtown Pittsburgh — Pittsburgh, Pennsylvania" }
  ];
  const matched = fallbacks.filter(f => f.display_name.toLowerCase().includes(lower));
  return matched.length ? matched : fallbacks; 
}

export async function parseProfile(text: string): Promise<ProfileParseResponse> {
  await mockDelay(650);
  return {
    profile_id: "custom_" + Date.now(),
    base_profile: "wheelchair",
    max_comfortable_grade: 5,
    hard_max_grade: 8,
    max_continuous_walk_m: 500,
    avoid_uncontrolled_crossings: true,
    prefer_rest_points: true,
    notes: text,
    summary: `Based on your description, Stepwise will prioritize routes that avoid steps and steep hills, looking for smooth paths and curb cuts.`,
    is_fallback: true
  };
}