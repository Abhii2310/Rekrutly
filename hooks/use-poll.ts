"use client"

import * as React from "react"

/**
 * Polls a recruiter endpoint every 2s while the tab is visible. Keeps the last good data on error and
 * reports `reconnecting` after 3 failures in a row. In-flight requests are aborted on unmount.
 */
export function usePoll<T>(url: string, options: { initial?: T; intervalMs?: number; enabled?: boolean } = {}) {
  const { initial, intervalMs = 2000, enabled = true } = options
  const [data, setData] = React.useState<T | undefined>(initial)
  const [failures, setFailures] = React.useState(0)

  React.useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let stopped = false

    const tick = async () => {
      if (stopped) return
      if (document.visibilityState === "visible") {
        controller = new AbortController()
        try {
          const res = await fetch(url, { signal: controller.signal, cache: "no-store" })
          if (!res.ok) throw new Error(String(res.status))
          const body = (await res.json()) as { data: T }
          if (!stopped) { setData(body.data); setFailures(0) }
        } catch (e) {
          if (!stopped && !(e instanceof DOMException && e.name === "AbortError")) setFailures((n) => n + 1)
        }
      }
      if (!stopped) timer = setTimeout(tick, intervalMs)
    }
    const onVisible = () => { if (document.visibilityState === "visible") { clearTimeout(timer); void tick() } }
    document.addEventListener("visibilitychange", onVisible)
    timer = setTimeout(tick, intervalMs)

    return () => {
      stopped = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [url, intervalMs, enabled])

  return { data, reconnecting: failures >= 3 }
}
