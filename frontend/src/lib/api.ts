import type { ConfigResponse, GeocodeResult, ProfileName, ProfileParseResponse, ReportOut, RouteResponse } from "./types"

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return res.json();
}

export async function getConfig(): Promise<ConfigResponse> {
  const res = await fetch("/api/config");
  return parseJsonOrThrow(res);
}

export async function postRoutes(params: {
  start_lat: number; start_lon: number; end_lat: number; end_lon: number;
  profile: ProfileName; custom_profile_id?: string | null;
}): Promise<RouteResponse> {
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow(res);
}

export async function getReports(): Promise<ReportOut[]> {
  const res = await fetch("/api/reports");
  return parseJsonOrThrow(res);
}

export async function createReport(params: {
  photo: Blob; lat: number; lon: number; note?: string;
}): Promise<ReportOut> {
  const form = new FormData();
  form.append("photo", params.photo, "photo.jpg");
  form.append("lat", String(params.lat));
  form.append("lon", String(params.lon));
  if (params.note) form.append("note", params.note);
  const res = await fetch("/api/reports", { method: "POST", body: form });
  return parseJsonOrThrow(res);
}

export async function confirmReport(id: string, stillThere: boolean): Promise<ReportOut> {
  const res = await fetch(`/api/reports/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ still_there: stillThere }),
  });
  return parseJsonOrThrow(res);
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  return parseJsonOrThrow(res);
}

export async function parseProfile(text: string): Promise<ProfileParseResponse> {
  const res = await fetch("/api/profile/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return parseJsonOrThrow(res);
}
