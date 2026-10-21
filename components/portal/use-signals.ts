"use client"

import * as React from "react"
import { portalFetch } from "./api"

type Signal = { type: "tab_hidden" | "paste" | "window_blur"; at: string }

/**
 * Collects tab-switch, paste and window-blur hints and sends them in batches every 10 seconds and on submit.
 * They are signals for a human to read, never proof, and a failure to send is silently ignored.
 */
export function useSignals(token: string, active: boolean) {
  const queue = React.useRef<Signal[]>([])

  const send = React.useCallback(() => {
    const events = queue.current.splice(0, 20)
    if (events.length === 0) return
    void portalFetch(token, "/signals", { method: "POST", body: JSON.stringify({ events }), keepalive: true })
  }, [token])

  React.useEffect(() => {
    if (!active) return
    const push = (type: Signal["type"]) => queue.current.push({ type, at: new Date().toISOString() })
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
  }, [active, send])

  return { flushSignals: send }
}
