"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { joinState, whenLabel } from "@/lib/interviews/rules"

/** Enables itself when the room opens, so the candidate never has to guess or refresh. */
export function JoinButton({ scheduledAt, durationMinutes, meetingUrl }: { scheduledAt: string; durationMinutes: number; meetingUrl: string }) {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])
  const start = new Date(scheduledAt)
  const state = joinState(now, start, durationMinutes)
  if (state === "ended") return <p className="t-body text-ink-2">This interview time has passed. Reply to the email from the hiring team if you need a new time.</p>
  if (state === "early") {
    const mins = Math.max(1, Math.ceil((start.getTime() - 10 * 60_000 - now.getTime()) / 60_000))
    return (
      <div>
        <Button className="h-12 w-full sm:w-auto sm:px-8" disabled>Join the interview</Button>
        <p className="t-callout mt-3 text-ink-2">The room opens 10 minutes before the start, in about {mins >= 120 ? `${Math.round(mins / 60)} hours` : mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}. This button turns on by itself.</p>
        <p className="t-footnote mt-1 text-ink-3">{whenLabel(start)}</p>
      </div>
    )
  }
  return (
    <div>
      <Button asChild className="h-12 w-full sm:w-auto sm:px-8"><a href={meetingUrl} target="_blank" rel="noreferrer">Join the interview</a></Button>
      <p className="t-callout mt-3 text-ink-2">It opens the video call in a new tab. Allow the camera and microphone when your browser asks.</p>
    </div>
  )
}
