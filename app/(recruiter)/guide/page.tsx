import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"

const STEPS = [
  ["Add candidates", "Open Jobs, pick a role, then Add candidate (name, email, role) or Import CSV. Double-check email spelling: a wrong address bounces."],
  ["Create the assessment", "Easiest: open Candidates, tick the people (one role at a time) and press Create assessment. Or open Command and click Create and send an assessment. Either way it writes the questions and shows you a plan. Nothing is sent yet."],
  ["Review and approve", "Edit any question. Choose the time limit and who gets a link. Tick Record the candidate on camera for a proctored exam. Press Approve."],
  ["Candidates take the exam", "Each person gets an email with their personal link and instructions. No account needed. They agree, check their camera, and start."],
  ["Watch it live", "Open the War Room. You see who started, a live camera picture for each person, and alerts with a chime."],
  ["Shortlist from resumes", "Open a candidate, add their resume (PDF or text) and press Check the match. You see which of the role's skills appear, with quotes. Shortlist is your own decision."],
  ["Interview and offer", "From the same profile, Schedule an interview (they get a join link and calendar link), take notes and fill in the scorecard, then draft an offer letter, edit it and send it. The Portfolio page shows every step in one place."],
  ["Review and decide", "Open results for scores with evidence. Open the recording to jump to every flagged moment. You decide; Rekrutly never picks a winner."],
] as const

const PAGES = [
  ["Overview", "Your starting point: what to do next, who needs you, and recent activity."],
  ["Command", "Type or speak one sentence. Rekrutly makes a plan you approve."],
  ["Jobs", "Your roles and their candidates. Add or import people here."],
  ["Candidates", "Everyone in one list. Open a profile to change an email, export their data or delete it."],
  ["War Room", "The live view of a running assessment: steps, candidates, cameras and alerts."],
  ["Analytics", "How your hiring is going: completion, scores and time."],
  ["Activity", "A receipt for every action Rekrutly took, with a CSV export for audits."],
  ["Settings", "System status and a one-click check that the AI is answering."],
] as const

const ALERTS = [
  ["No face in view", "Their face left the camera for a few seconds."],
  ["More than one face", "A second person appeared in the picture."],
  ["Head turned away", "They turned their head away from the screen for a while."],
  ["Eyes off the screen", "Their eyes pointed sideways for a few seconds with the head facing the screen."],
  ["Voice heard", "Someone spoke in the room for a couple of seconds. Nothing is transcribed."],
  ["Switched tab, left full screen, copied text, went offline", "Things the browser can see them do on the exam page."],
] as const

const FAQ = [
  ["Is anyone failed automatically?", "No. Alerts are signals worded as Review this moment. A person always decides."],
  ["Where does the video go?", "Into a private store. Only a signed-in recruiter can watch it, through short-lived links. No recording goes to any AI. Deleting a candidate deletes their recordings."],
  ["What if a candidate refuses the camera?", "A proctored exam can't start without it. Create the assessment without the camera option for them."],
  ["The email bounced.", "The address doesn't exist. Ask the person for the exact address, fix it in their profile or with Use a real email on the approval screen, and send a fresh assessment."],
  ["Do candidates need an account?", "No. The link in the email is their way in. It is personal, works once, and the timer is kept by the server."],
] as const

/** A short guide for someone new: the flow, what each page is for, what alerts mean, and common questions. */
export default function GuidePage() {
  return (
    <>
      <PageHeader title="Guide" description="Everything you need in two minutes." actions={<Button asChild><Link href="/command">Start now</Link></Button>} />
      <PageBody className="max-w-[860px]">
        <Section title="The whole flow" className="mt-4">
          <ol className="flex flex-col gap-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex items-start gap-3.5">
                <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[14px] font-medium text-canvas">{i + 1}</span>
                <div><p className="t-headline text-ink">{title}</p><p className="t-body mt-0.5 text-ink-2">{text}</p></div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="What each page is for">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {PAGES.map(([name, text]) => (
              <div key={name}><dt className="t-headline text-ink">{name}</dt><dd className="t-callout mt-0.5 text-ink-2">{text}</dd></div>
            ))}
          </dl>
        </Section>

        <Section title="What the alerts mean">
          <p className="t-body mb-4 text-ink-2">They appear live in the War Room and as red dots on the recording. They are hints to look at, never proof. People look away and lose connections for ordinary reasons.</p>
          <dl className="flex flex-col gap-3">
            {ALERTS.map(([name, text]) => (
              <div key={name} className="rounded-control bg-mist px-4 py-3"><dt className="t-body text-ink">{name}</dt><dd className="t-callout mt-0.5 text-ink-2">{text}</dd></div>
            ))}
          </dl>
        </Section>

        <Section title="Common questions">
          <dl className="flex flex-col gap-5">
            {FAQ.map(([q, a]) => (
              <div key={q}><dt className="t-headline text-ink">{q}</dt><dd className="t-body mt-0.5 text-ink-2">{a}</dd></div>
            ))}
          </dl>
        </Section>
      </PageBody>
    </>
  )
}
