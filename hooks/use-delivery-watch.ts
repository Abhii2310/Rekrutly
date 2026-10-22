"use client"

import * as React from "react"

/**
 * A wrong address only shows up as a bounce a little later. While invitation emails are out and unopened, look for bounces
 * quickly at first and then every minute, never two at once. A bounce turns the row red so the address can be fixed.
 */
export function useDeliveryWatch(emailsOut: boolean): void {
  React.useEffect(() => {
    if (!emailsOut) return
    let busy = false
    let runs = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return schedule()
      busy = true
      try { await fetch("/api/delivery/check", { method: "POST" }) } catch { /* try again later */ }
      busy = false
      runs++
      schedule()
    }
    const schedule = () => { timer = setTimeout(() => void check(), runs < 3 ? 20_000 : 60_000) }
    timer = setTimeout(() => void check(), 4_000)
    return () => { if (timer) clearTimeout(timer) }
  }, [emailsOut])
}
