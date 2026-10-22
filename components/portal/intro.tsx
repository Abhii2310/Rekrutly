"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { CameraCheck } from "./proctor/camera-check"
import { PortalShell } from "./shell"
import type { PortalInfo } from "./api"

export function Intro({
  info, onStart, starting, error, stream, onStream,
}: { info: PortalInfo; onStart: () => void; starting: boolean; error: string | null; stream: MediaStream | null; onStream: (s: MediaStream | null) => void }) {
  const [agreed, setAgreed] = React.useState(false)
  const [agreedCamera, setAgreedCamera] = React.useState(false)
  const ready = agreed && (!info.proctored || (agreedCamera && stream !== null))
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
          {info.proctored ? <li>This assessment is recorded on your camera and microphone. A reviewer can watch and listen to the recording.</li> : null}
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

      {info.proctored ? (
        <section className="mt-4 rounded-group bg-mist p-5" aria-labelledby="camera-title">
          <h2 id="camera-title" className="t-headline text-ink">Camera recording</h2>
          <ul className="t-callout mt-3 flex flex-col gap-2 text-ink-2">
            <li>Your camera and microphone record from the moment you start until you submit.</li>
            <li>Your device checks, on the device itself, whether your face is in view, where your eyes point, and whether a voice is heard. The recording is not sent to any AI, and nothing you say is transcribed.</li>
            <li>The reviewer is told about moments worth a look, such as your face leaving view, your eyes looking away for a while, or a voice in the room. These are signals, not proof, and nothing fails automatically.</li>
            <li>Only the hiring team can watch the recording. You can ask them to delete it.</li>
          </ul>
          <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={agreedCamera} onChange={(e) => setAgreedCamera(e.target.checked)} className="focus-ring size-5 shrink-0 accent-[var(--color-action)]" />
            <span className="t-body text-ink">I agree to be recorded on camera and microphone</span>
          </label>
          {agreedCamera ? <CameraCheck stream={stream} onStream={onStream} /> : null}
        </section>
      ) : null}

      {error ? <p role="alert" className="t-callout mt-4 text-danger">{error}</p> : null}
      <div className="mt-6">
        <Button className="h-12 w-full sm:w-auto sm:px-8" loading={starting} disabled={!ready} onClick={onStart}>Start assessment</Button>
        <p className="t-callout mt-3 text-ink-2">The timer starts when you press the button and keeps running if you close the page.</p>
        {info.aiTaskAnnounced ? <p className="t-callout mt-1 text-ink-2">After the test there is a short work task where you can use an AI assistant. It can be wrong, so check its work.</p> : null}
        {info.aiInterviewAnnounced ? <p className="t-callout mt-1 text-ink-2">After the test there is a short conversation with an AI interviewer, about 10 minutes. You can speak or type.</p> : null}
        {info.proctored ? <p className="t-callout mt-1 text-ink-2">Keep this page open and your camera on until you submit.</p> : null}
      </div>
    </PortalShell>
  )
}
