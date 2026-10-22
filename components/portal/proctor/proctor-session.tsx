"use client"

import * as React from "react"
import { newRuleState, newVoiceState, step, stepVoice } from "@/lib/proctor/rules"
import type { SignalType } from "@/lib/proctor/signals"
import { loadFaceDetector } from "./face-detector"
import { startRecorder, type Recorder } from "./use-recorder"
import { startVoiceMeter } from "./voice-detector"

export type ProctorHandle = { stop: () => Promise<void> }

const LOOK_EVERY_MS = 600
const SNAPSHOT_EVERY_MS = 5000

/**
 * The camera side of a proctored exam, while the test is running: a small mirror so the candidate can see what is
 * recorded, the 30-second recorder, a live picture for the recruiter, and the checks that raise review signals.
 */
export function ProctorSession({
  token, stream, startedAt, push, handleRef,
}: {
  token: string
  stream: MediaStream
  startedAt: number
  push: (type: SignalType, detail?: Record<string, string | number | boolean>) => void
  handleRef: React.RefObject<ProctorHandle | null>
}) {
  const video = React.useRef<HTMLVideoElement>(null)
  const pushRef = React.useRef(push)
  React.useEffect(() => { pushRef.current = push }, [push])

  React.useEffect(() => {
    const el = video.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})

    const recorder: Recorder | null = startRecorder(token, stream, startedAt)
    handleRef.current = { stop: async () => { await recorder?.stop() } }

    let alive = true
    const rules = newRuleState()
    let detector: Awaited<ReturnType<typeof loadFaceDetector>> = null
    void loadFaceDetector().then((d) => { if (alive) detector = d })

    const look = setInterval(() => {
      if (!detector || el.readyState < 2) return
      try {
        for (const s of step(rules, detector.look(el, performance.now()), Date.now())) pushRef.current(s)
      } catch { /* a bad frame is skipped */ }
    }, LOOK_EVERY_MS)

    const voice = newVoiceState()
    const stopVoice = startVoiceMeter(stream, (level, now) => { if (stepVoice(voice, level, now)) pushRef.current("voice_detected") })

    const canvas = document.createElement("canvas")
    canvas.width = 320
    canvas.height = 240
    const snap = setInterval(() => {
      if (el.readyState < 2) return
      canvas.getContext("2d")?.drawImage(el, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (!blob) return
        void fetch(`/api/c/${token}/snapshot`, { method: "POST", body: blob, headers: { "content-type": "image/jpeg" } }).catch(() => {})
      }, "image/jpeg", 0.6)
    }, SNAPSHOT_EVERY_MS)

    const track = stream.getVideoTracks()[0]
    const onEnded = () => pushRef.current("camera_off")
    track?.addEventListener("ended", onEnded)
    track?.addEventListener("mute", onEnded)

    const onCopy = () => pushRef.current("copy")
    const onOffline = () => pushRef.current("offline")
    const onFullscreen = () => { if (!document.fullscreenElement) pushRef.current("fullscreen_exit") }
    document.addEventListener("copy", onCopy)
    window.addEventListener("offline", onOffline)
    const wasFullscreen = Boolean(document.fullscreenElement)
    if (wasFullscreen) document.addEventListener("fullscreenchange", onFullscreen)

    return () => {
      alive = false
      clearInterval(look)
      clearInterval(snap)
      stopVoice?.()
      track?.removeEventListener("ended", onEnded)
      track?.removeEventListener("mute", onEnded)
      document.removeEventListener("copy", onCopy)
      window.removeEventListener("offline", onOffline)
      document.removeEventListener("fullscreenchange", onFullscreen)
      void recorder?.stop()
      handleRef.current = null
    }
  }, [token, stream, startedAt, handleRef])

  return (
    <div className="fixed bottom-4 right-4 z-20 w-[120px] overflow-hidden rounded-control bg-ink shadow-lg sm:w-[148px]" aria-label="Your camera, being recorded">
      <video ref={video} muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
      <div className="t-footnote flex items-center gap-1.5 bg-ink px-2 py-1 text-canvas">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-[#FF453A]" />
        Recording{stream.getAudioTracks().length > 0 ? " with sound" : ""}
      </div>
    </div>
  )
}
