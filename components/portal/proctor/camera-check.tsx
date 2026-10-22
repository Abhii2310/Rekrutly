"use client"

import * as React from "react"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { startVoiceMeter } from "./voice-detector"

const VIDEO = { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } as const

/**
 * Asks for the camera and the microphone, and shows the candidate what will be recorded before they can start.
 * If the microphone is refused or missing, the camera alone is used, so the exam can still go ahead.
 */
export async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: { echoCancellation: true, noiseSuppression: false } })
  } catch {
    return navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: false })
  }
}

export function CameraCheck({ stream, onStream }: { stream: MediaStream | null; onStream: (s: MediaStream | null) => void }) {
  const video = React.useRef<HTMLVideoElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [level, setLevel] = React.useState(0)
  const hasMic = (stream?.getAudioTracks().length ?? 0) > 0

  React.useEffect(() => {
    if (!stream) return
    return startVoiceMeter(stream, (l) => setLevel(l)) ?? undefined
  }, [stream])

  React.useEffect(() => {
    const el = video.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => {})
  }, [stream])

  async function turnOn() {
    setBusy(true)
    setError(null)
    try {
      onStream(await openCamera())
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")
      setError(denied
        ? "The camera is blocked. Allow camera access for this page in your browser settings, then try again."
        : "We couldn't find a working camera. Check that no other app is using it, then try again.")
    }
    setBusy(false)
  }

  return (
    <div className="mt-5">
      {stream ? (
        <div className="overflow-hidden rounded-control bg-ink">
          <video ref={video} muted playsInline className="aspect-[4/3] w-full max-w-[320px] -scale-x-100 object-cover" />
        </div>
      ) : (
        <Button variant="secondary" loading={busy} onClick={() => void turnOn()}>
          <Camera aria-hidden className="size-4" strokeWidth={1.75} />
          Turn on my camera
        </Button>
      )}
      {stream ? (
        <>
          <p className="t-callout mt-2 text-ink-2">Camera is working. Sit so your face is in view and the room is lit, then start.</p>
          {hasMic ? (
            <div className="mt-3 max-w-[320px]">
              <div className="h-2 overflow-hidden rounded-full bg-fog" role="img" aria-label="Microphone level">
                <div className="h-full rounded-full bg-success transition-[width] duration-150" style={{ width: `${Math.min(100, level * 600)}%` }} />
              </div>
              <p className="t-callout mt-1 text-ink-2">Microphone is working. Say hello and the bar should move.</p>
            </div>
          ) : (
            <p className="t-callout mt-3 text-ink-2">No microphone found or allowed. You can still start; only the camera is recorded.</p>
          )}
        </>
      ) : null}
      {error ? <p role="alert" className="t-callout mt-2 text-danger">{error}</p> : null}
    </div>
  )
}
