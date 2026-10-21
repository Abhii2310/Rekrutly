# Rekrutly demo runbook

A five-minute demo with a recovery move for every failure. Read it once, rehearse it three times with a timer, and record a backup video of a clean run on the production URL.

## Settings the demo depends on

Set these in Vercel (names only here; never write values in a doc) before the first deploy, then redeploy after any change:

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER`, `AI_FALLBACK_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `AI_MODEL_SMART`, `AI_MODEL_FAST`, `AI_FALLBACK_MODEL`, `RECRUITER_PASSCODE`, `SESSION_SECRET`, `TOKEN_ENC_KEY`, `APP_URL` (the real Vercel URL), `DEMO_MODE=true`, `TASK_OVERDUE_MINUTES=2`, `DEMO_CANDIDATE_WHATSAPP` (your own number; the reset puts it on Aarav and Kabir so "Open in WhatsApp" works), and optionally `RESEND_API_KEY`, `EMAIL_FROM`, `DEMO_CANDIDATE_EMAIL`.

- `TASK_OVERDUE_MINUTES=2` is what makes a nudge task appear for a candidate who has not started within two minutes. The default is 60.
- Gemini's free tier ran out of quota during testing. For a smooth demo use a paid or fresh key. Groq is the backup and can rate-limit in bursts.

## Production check (do this once after deploying)

1. Open `<APP_URL>/api/health`. Expect `"db":"ok"`, the AI provider names, and `"demoMode":true`.
2. `PLAYWRIGHT_BASE_URL=<APP_URL> E2E_USE_FALLBACK=true npm run e2e` (deterministic).
3. `PLAYWRIGHT_BASE_URL=<APP_URL> npm run e2e` (real AI). Note how long planning, question writing and scoring take; the demo timings below assume about 10 s, 30 s and 30 s.
4. `npm run capture:fallback -- --run <run id>` after one good run on the seeded Full-Stack job, and commit the two JSON files, so "Use saved demo plan" matches the latest wording.

## Before the demo starts

Open the public address (the root of your Vercel URL) in a private window to see the landing page. It is a good thing to leave on screen while people sit down. Press **Sign in**, then use the passcode to enter the app.

## Pre-flight (start 30 minutes before)

1. Laptop charged and plugged in. Notifications off (Do Not Disturb). Browser zoom 110%.
2. **Hotspot** on your phone ready as the Wi-Fi backup.
3. Open `<APP_URL>/api/health` and check it says `ok`.
4. Chrome, recruiter window: sign in. Open **Demo Director** (`/demo`). Check the checklist rows: Database Connected, AI Configured.
5. Press **Reset demo data** and confirm. Wait for "Reset done".
6. **Dress rehearsal for the safety net** (5 minutes): go through the demo once, and for the simulation step tick everyone. When the reports are ready, open one simulated candidate's submission page and **leave that tab open and do not refresh it**. This is your pre-scored evidence if live scoring is slow.
7. **Reset demo data** again for the real run. (The rehearsal tab stays on screen because it was already loaded.)
8. Phone: open the browser, keep the screen awake. You will open Aarav's link from Demo Director in step 3.
9. A second Chrome tab with the **backup video** loaded and paused.
10. Close every other app and tab. Zoom the recruiter window so the back row can read it.

## The five minutes, click by click

Windows: Chrome on the laptop (recruiter) and the phone (candidate).

### Minute 1: the problem, then one instruction

- **Say:** "A 40-person startup is hiring a full-stack developer. One person juggles assessments, chasing, scoring and scheduling across email, sheets and WhatsApp. Watch what one instruction does."
- **Do:** Sidebar **Command**. Click the microphone and speak the sentence, or click the first example under "Try". Press **Enter**.
  > Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Cover React, APIs, SQL and debugging. Show me the questions before inviting anyone.
- **Point at:** the plan with "5 candidates, 1 without email", the assumptions line, and the steps waiting for you.
- **If it fails:** AI slow or error → press **Use saved demo plan** on the error. The plan shows a "Saved" pill; say so ("this is a saved plan, so the demo does not depend on the internet").

### Minute 2: the agent shows its work before acting

- **Do:** **Write the questions**. When the list appears, expand question 1 (chevron on the right), **Edit**, change a word, **Save**; point at "Edited" and at the "Suggested by AI" marks. Show the right-hand panel: time limit, who gets a link, the invitation preview.
- **Say:** "Nothing has happened yet. Rekrutly proposes; I decide." Click **Approve and create links**. The steps fill in one by one; email says "not configured" honestly.
- **Optional (10 s):** go back to **Command**, click the third example ("...but only invite candidates under 30") and show the guardrail notice: the filter it left out, the reason, and that nothing runs until you approve.
- **If it fails:** question writing slow or errors → **Use saved questions** (shows "Saved"). Approve button greyed → check the time limit and that at least one person is ticked.

### Minute 3: the candidate

- **Do:** **Demo Director** → **Open Aarav's candidate link** (or **Copy link** on the run page and send it to your phone). On the phone: read the consent notice aloud in one sentence, tick **I understand**, **Start assessment**, answer two questions.
- **Meanwhile:** laptop → sidebar **War Room**. Point at Aarav's row: "Question 2 of 10" and the time left counting down.
- **Do:** back in **Demo Director**, under "Simulate submissions" **untick Kabir and Ishita** (they stay un-started so the nudge tasks appear later), then **Start**. The others submit one by one, 8 to 12 seconds apart, each labelled Simulated.
- Finish Aarav on the phone: **Review and submit** → **Submit assessment** → **Submit**.
- **If it fails:** link will not open on the phone → open Aarav's link in a second Chrome window at phone width (Demo Director → Open Aarav's candidate link). Wi-Fi down → switch to the hotspot; if it is still down, play the backup video.

### Minute 4: evidence, not vibes

- **Do:** War Room → **View results** → click Aarav. Show the objective score ("computed by code") and the suggested AI score (with its label). Click a written question: the exact quote highlighted, the rubric points matched and missing, the confidence. Use **Override score** with a short reason; show the new "Adjusted" label.
- **Say:** "Every number here has a source. The AI suggests; the recruiter decides; Rekrutly records both." Scroll to the interview questions aimed at the weakest skill.
- Optional: on the results page tick two candidates and press **Compare**; point at the line "Rekrutly doesn't pick a winner."
- **If it fails:** scoring still running or a row says "Scoring failed" → show the objective score first (it is instant), press **Retry scoring** on the submission page, and meanwhile switch to the **rehearsal tab you left open** and narrate the evidence sheet there. Do not refresh that tab.

### Minute 5: the coordination layer

- **Do:** **War Room** → **Needs you**. Open **Nudge Kabir to start**. If it is empty, wait: nudge tasks appear two minutes after the links were created and the page refreshes itself. Click **Write message** (or read the drafted one), switch the language control to **हिन्दी** or **ಕನ್ನಡ** and wait a few seconds, then **Open in WhatsApp** (it opens with the text filled in; you press send, never the AI). Scroll **Activity** to show the receipts.
- **Close:** "Others are building agents that act on their own. We are building the one a small team can trust: it plans, it asks, it acts only when allowed, and it keeps a receipt for everything. That is Rekrutly." Then the real recruiter quote from your validation calls.
- **If it fails:** draft is slow → switch back to English (already drafted) and say the other languages take a few seconds. "Open in WhatsApp" missing → the candidate has no phone (only Aarav and Kabir get yours, and only after a reset with `DEMO_CANDIDATE_WHATSAPP` set); use **Copy message** and paste it into WhatsApp Web.

## Recovery cheat sheet

| What goes wrong | Do this |
|---|---|
| AI is slow or returns an error on the plan | **Use saved demo plan** |
| AI is slow or errors on questions | **Use saved questions** |
| Scoring is slow or "Scoring failed" | Show the objective score, press **Retry scoring**, narrate the evidence sheet on the rehearsal tab |
| Wi-Fi drops | Phone hotspot; if that fails, play the backup video |
| Candidate link will not open | Demo Director → **Open Aarav's candidate link** in a second window |
| A page says "This page couldn't load" | Reload once; if it persists, open the same page from the sidebar |
| Reports never appear for simulated candidates | Demo Director retries on its own; otherwise open each submission and press **Retry scoring** |
| Everything is wrong | Demo Director → **Reset demo data**, then start the script again from Minute 1 |

## After the demo

- Say what is real and what is simulated if asked: see the README section "What is real and what is simulated". Simulated candidates are labelled **Simulated** on screen; the AI that powered the demo ran on free tiers with demo data only.
- **Reset demo data** before the next audience.
