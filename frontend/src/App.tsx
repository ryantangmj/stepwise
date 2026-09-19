import { useEffect, useState } from "react"
import { getConfig } from "./api"
import MapScreen from "./screens/MapScreen"
import ProfileScreen from "./screens/ProfileScreen"
import ReportScreen from "./screens/ReportScreen"
import type { ConfigResponse, LatLon, ProfileName } from "./types"

type Tab = "map" | "report" | "profile"

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "map", label: "Map", icon: "🗺️" },
  { id: "report", label: "Report", icon: "📷" },
  { id: "profile", label: "Profile", icon: "👤" },
]

export default function App() {
  const [tab, setTab] = useState<Tab>("map")
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [profile, setProfile] = useState<ProfileName>("wheelchair")
  const [start, setStart] = useState<LatLon | null>(null)
  const [end, setEnd] = useState<LatLon | null>(null)
  const [reportsVersion, setReportsVersion] = useState(0)

  useEffect(() => {
    getConfig().then((cfg) => {
      setConfig(cfg)
      setStart(cfg.demo_start)
      setEnd(cfg.demo_end)
    })
  }, [])

  const refreshReports = () => setReportsVersion((v) => v + 1)

  return (
    <div className="flex h-dvh flex-col bg-[#f4f5f3]">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-xl font-bold text-gray-900">Stepwise</h1>
        {config?.demo_mode && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            Demo mode
          </span>
        )}
      </header>

      <main className="min-h-0 flex-1">
        {!config || !start || !end ? (
          <div className="flex h-full items-center justify-center text-gray-500">Loading Stepwise…</div>
        ) : tab === "map" ? (
          <MapScreen
            config={config}
            profile={profile}
            onProfileChange={setProfile}
            start={start}
            end={end}
            onStartChange={setStart}
            onEndChange={setEnd}
            reportsVersion={reportsVersion}
            onReportsChanged={refreshReports}
          />
        ) : tab === "report" ? (
          <ReportScreen
            defaultLocation={start}
            onReportSubmitted={() => {
              refreshReports()
              setTab("map")
            }}
          />
        ) : (
          <ProfileScreen profile={profile} onProfileChange={setProfile} />
        )}
      </main>

      <nav className="flex border-t border-gray-200 bg-white">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tap-target flex flex-1 flex-col items-center gap-0.5 py-2 text-sm font-medium ${
              tab === t.id ? "text-teal-700" : "text-gray-500"
            }`}
          >
            <span className="text-xl" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
