import { useEffect, useRef, useState } from "react"
import { parseProfile } from "../api"
import { PROFILE_PRESETS } from "../profiles"
import type { ProfileName } from "../types"

interface Props {
  profile: ProfileName
  customProfileSummary: string | null
  onProfileChange: (p: ProfileName) => void
  onCustomProfileParsed: (profileId: string, summary: string) => void
}

const PROFILE_DESCRIPTIONS: Record<ProfileName, string> = {
  wheelchair:
    "Avoids steps entirely, requires curb cuts at crossings, and keeps hills gentle (comfortable up to about 5%, hard limit 8%).",
  walker:
    "Avoids steps entirely, prefers routes with places to rest, and tolerates slightly steeper hills than a wheelchair profile (comfortable up to about 6%, hard limit 10%).",
  cane: "Steps are allowed but penalized in favor of ramps, and hills up to about 12% are tolerated.",
  custom: "Built from your own description of your needs.",
}

// Minimal ambient typing for the still-nonstandard (webkit-prefixed) Web
// Speech API — not in lib.dom.d.ts. Feature-detected at runtime below, so
// the mic button simply doesn't render on browsers that lack it.
interface SpeechRecognitionResultLike {
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function ProfileScreen({ profile, customProfileSummary, onProfileChange, onCustomProfileParsed }: Props) {
  const [text, setText] = useState("")
  const [listening, setListening] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSummary, setPendingSummary] = useState<{ profileId: string; summary: string; isFallback: boolean } | null>(
    null,
  )
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechSupported = useRef(getSpeechRecognition() !== null)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function toggleListening() {
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) return

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = "en-US"
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ")
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  async function handleParse() {
    if (!text.trim()) return
    setParsing(true)
    setError(null)
    setPendingSummary(null)
    try {
      const result = await parseProfile(text)
      setPendingSummary({ profileId: result.profile_id, summary: result.summary, isFallback: result.is_fallback })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse your profile — please try again")
    } finally {
      setParsing(false)
    }
  }

  function confirmParsed() {
    if (!pendingSummary) return
    onCustomProfileParsed(pendingSummary.profileId, pendingSummary.summary)
    setPendingSummary(null)
  }

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

      {profile === "custom" && customProfileSummary && (
        <div className="rounded-lg border-2 border-teal-700 bg-teal-50 p-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-teal-900">
            <span aria-hidden>✨</span>
            Custom (active)
          </div>
          <div className="mt-1 text-sm text-teal-800">{customProfileSummary}</div>
        </div>
      )}

      <div className="space-y-2 rounded-lg border-2 border-gray-300 p-3">
        <div className="font-semibold text-gray-900">Describe your needs in your own words</div>
        <div className="flex items-start gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. I use a rollator, get tired after about 200m, and hate crossing busy roads"
            className="w-full flex-1 rounded-lg border-2 border-gray-300 p-2 text-base"
            rows={3}
          />
          {speechSupported.current && (
            <button
              onClick={toggleListening}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              className={`tap-target shrink-0 rounded-full text-xl ${
                listening ? "bg-red-600 text-white" : "border-2 border-gray-300 text-gray-700"
              }`}
            >
              🎤
            </button>
          )}
        </div>
        {listening && <p className="text-sm text-teal-700">Listening…</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          onClick={handleParse}
          disabled={!text.trim() || parsing}
          className="tap-target w-full rounded-lg bg-teal-700 text-base font-semibold text-white disabled:opacity-60"
        >
          {parsing ? "Thinking…" : "Use this description"}
        </button>
      </div>

      {pendingSummary && (
        <div className="space-y-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
          <div className="font-semibold text-amber-900">Here's what we understood:</div>
          <div className="text-amber-900">{pendingSummary.summary}</div>
          {pendingSummary.isFallback && (
            <div className="text-xs text-amber-700">
              (AI text parsing was unavailable, so this uses your description as-is — routing still applies your
              base profile's defaults.)
            </div>
          )}
          <button
            onClick={confirmParsed}
            className="tap-target w-full rounded-lg bg-teal-700 text-base font-semibold text-white"
          >
            ✓ Looks right — use this profile
          </button>
        </div>
      )}
    </div>
  )
}
