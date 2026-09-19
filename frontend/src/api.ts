import type { ConfigResponse, ProfileName, ReportOut, RouteResponse } from "./types"

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let message = resp.statusText
    try {
      const body = await resp.json()
      message = body.detail ?? message
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message)
  }
  return resp.json() as Promise<T>
}

export function getConfig(): Promise<ConfigResponse> {
  return fetch("/api/config").then((r) => handle<ConfigResponse>(r))
}

export function postRoutes(params: {
  start_lat: number
  start_lon: number
  end_lat: number
  end_lon: number
  profile: ProfileName
}): Promise<RouteResponse> {
  return fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then((r) => handle<RouteResponse>(r))
}

export function getReports(): Promise<ReportOut[]> {
  return fetch("/api/reports").then((r) => handle<ReportOut[]>(r))
}

export function createReport(params: {
  photo: Blob
  lat: number
  lon: number
  note?: string
}): Promise<ReportOut> {
  const form = new FormData()
  form.append("photo", params.photo, "hazard.jpg")
  form.append("lat", String(params.lat))
  form.append("lon", String(params.lon))
  if (params.note) form.append("note", params.note)
  return fetch("/api/reports", { method: "POST", body: form }).then((r) => handle<ReportOut>(r))
}

export function confirmReport(id: string, stillThere: boolean): Promise<ReportOut> {
  return fetch(`/api/reports/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ still_there: stillThere }),
  }).then((r) => handle<ReportOut>(r))
}
