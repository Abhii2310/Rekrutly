"use client"

import * as React from "react"
import type { SignalType } from "@/lib/proctor/signals"
import { portalFetch } from "./api"

type Detail = Record<string, string | number | boolean>
type Signal = { type: SignalType; at: string; videoMs?: number; detail?: Detail }

// Camera and screen signals reach the recruiter within a second. The quiet ones travel in 10-second batches.
const URGENT = new Set<SignalType>(["face_missing", "multiple_faces", "looking_away", "camera_off", "fullscreen_exit", "copy", "offline", "tab_hidden"])

/**
 * Collects tab-switch, paste and window-blur hints, plus the camera and screen signals pushed by the proctor, and sends
 * them to the server. They are signals for a human to read, never proof, and a failure to send is silently ignored.
 * `recordingStart` is when the recording began, so each signal can say where to look in the video.
 */
export function useSignals(token: string, active: boolean, recordingStart?: number | null) {
  const queue = React.useRef<Signal[]>([])
  const startRef = React.useRef(recordingStart ?? null)
  React.useEffect(() => { startRef.current = recordingStart ?? null }, [recordingStart])

  const send = React.useCallback(() => {
    const events = queue.current.splice(0, 20)
    if (events.length === 0) return
    void portalFetch(token, "/signals", { method: "POST", body: JSON.stringify({ events }), keepalive: true })
  }, [token])

  const push = React.useCallback((type: SignalType, detail?: Detail) => {
    const now = Date.now()
    const videoMs = startRef.current !== null ? Math.max(0, now - startRef.current) : undefined
    queue.current.push({ type, at: new Date(now).toISOString(), ...(videoMs !== undefined ? { videoMs } : {}), ...(detail ? { detail } : {}) })
    if (startRef.current !== null && URGENT.has(type)) send()
  }, [send])

  React.useEffect(() => {
    if (!active) return
    const onVisibility = () => { if (document.visibilityState === "hidden") push("tab_hidden") }
    const onBlur = () => push("window_blur")
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) push("paste")
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("blur", onBlur)
    document.addEventListener("paste", onPaste)
    const timer = setInterval(send, 10_000)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("paste", onPaste)
      clearInterval(timer)
    }
  }, [active, send, push])

  return { flushSignals: send, push }
}
