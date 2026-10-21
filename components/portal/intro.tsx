"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { PortalShell } from "./shell"
import type { PortalInfo } from "./api"

export function Intro({ info, onStart, starting, error }: { info: PortalInfo; onStart: () => void; starting: boolean; error: string | null }) {
  const [agreed, setAgreed] = React.useState(false)
  return (
    <PortalShell>
      <h1 className="t-large text-ink">Hi {info.firstName}.</h1>
      <p className="t-body mt-2 text-ink-2">{info.assessmentTitle && info.jobTitle && info.assessmentTitle.toLowerCase().includes(info.jobTitle.toLowerCase()) ? info.assessmentTitle : `${info.jobTitle}, ${info.assessmentTitle}`}</p>

      <dl className="mt-8 grid grid-cols-3 gap-4">
        {[
          [`${info.durationMinutes} min`, "Time limit"],
          [String(info.questionCount), "Questions"],
          ["One", "Attempt"],
        ].map(([value, label]) => (
          <div key={label}>
            <dt className="t-callout text-ink-2">{label}</dt>
            <dd className="t-title tabular mt-0.5 text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {info.instructions ? <p className="t-body mt-8 whitespace-pre-wrap text-ink">{info.instructions}</p> : null}

      <section className="mt-8 rounded-group bg-mist p-5" aria-labelledby="consent-title">
        <h2 id="consent-title" className="t-headline text-ink">Before you start</h2>
        <ul className="t-callout mt-3 flex flex-col gap-2 text-ink-2">
          <li>We collect your answers, your start and finish times, and when you switch tabs or paste text.</li>
          <li>We collect this to assess your application for this role.</li>
          <li>A person reviews your results. Nothing is decided automatically.</li>
          <li>Switching tabs is shown to the reviewer as a signal, not as proof of anything.</li>
          <li>To ask for your data to be deleted, reply to the recruiter who sent you this link.</li>
        </ul>
        <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="focus-ring size-5 shrink-0 accent-[var(--color-action)]" />
          <span className="t-body text-ink">I understand</span>
        </label>
      </section>

      {error ? <p role="alert" className="t-callout mt-4 text-danger">{error}</p> : null}
      <div className="mt-6">
        <Button className="h-12 w-full sm:w-auto sm:px-8" loading={starting} disabled={!agreed} onClick={onStart}>Start assessment</Button>
        <p className="t-callout mt-3 text-ink-2">The timer starts when you press the button and keeps running if you close the page.</p>
      </div>
    </PortalShell>
  )
}
