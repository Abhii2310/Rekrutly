"use client"

const PIECE_MS = 30_000

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  return ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
}

async function upload(token: string, seq: number, startedMs: number, durationMs: number, blob: Blob): Promise<void> {
  const url = `/api/c/${token}/segments?seq=${seq}&startedMs=${startedMs}&durationMs=${durationMs}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", body: blob, headers: { "content-type": blob.type || "video/webm" }, signal: AbortSignal.timeout(25_000) })
      if (res.ok || res.status === 409 || res.status === 400 || res.status === 413) return
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
}

export type Recorder = { stop: () => Promise<void> }

/**
 * Records the camera as 30-second pieces, each playable on its own, and uploads each as soon as it is done.
 * Video only: no microphone. Stopping uploads the last piece, so call it before submitting.
 */
export function startRecorder(token: string, stream: MediaStream, startedAt: number): Recorder | null {
  const mimeType = pickMime()
  if (typeof MediaRecorder === "undefined") return null
  let seq = 0
  let stopped = false
  let current: MediaRecorder | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const pending: Promise<void>[] = []

  const begin = () => {
    if (stopped) return
    const pieceStart = Date.now()
    const chunks: Blob[] = []
    const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 250_000 })
    const mySeq = seq++
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "video/webm" })
      if (blob.size > 0) pending.push(upload(token, mySeq, pieceStart - startedAt, Date.now() - pieceStart, blob))
    }
    rec.start()
    current = rec
    timer = setTimeout(() => { rec.stop(); begin() }, PIECE_MS)
  }
  begin()

  return {
    async stop() {
      if (stopped) return
      stopped = true
      if (timer) clearTimeout(timer)
      if (current && current.state !== "inactive") current.stop()
      await Promise.all(pending)
      // The last piece's upload is queued from onstop, which fires just after stop().
      await new Promise((r) => setTimeout(r, 50))
      await Promise.all(pending)
    },
  }
}
