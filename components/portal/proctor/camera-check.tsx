"use client"

import * as React from "react"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Asks for the camera and shows the candidate what will be recorded before they can start. Video only. */
export async function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false })
}

export function CameraCheck({ stream, onStream }: { stream: MediaStream | null; onStream: (s: MediaStream | null) => void }) {
  const video = React.useRef<HTMLVideoElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

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
      {stream ? <p className="t-callout mt-2 text-ink-2">Camera is working. Sit so your face is in view and the room is lit, then start.</p> : null}
      {error ? <p role="alert" className="t-callout mt-2 text-danger">{error}</p> : null}
    </div>
  )
}
