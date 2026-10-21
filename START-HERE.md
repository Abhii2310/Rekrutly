# Start here

This kit turns Claude Code into a disciplined team. You give it one prompt at a time; it reads the rules in `CLAUDE.md`, builds, tests, checks the design, commits, and tells you the next step.

## What's in the kit

```
CLAUDE.md                        rules Claude Code reads automatically every session
START-HERE.md                    this file
.env.example                     every setting the app needs
supabase/migrations/0001_init.sql  the database (already tested)
docs/ARCHITECTURE.md             how the backend, AI and security work
docs/DESIGN.md                   the Apple-clean design system
docs/PITCH.md                    positioning, 5-minute demo script, judge Q&A
docs/PROGRESS.md                 living status: working / simulated / not built
docs/prompts/01 … 14             the build prompts, in order
docs/prompts/R1 … R3             rescue prompts for bugs, polish and running late
```

## Setup (about 30 minutes, do this before hour 0)

1. **Tools.** Install Node 20.9 or newer (`node -v` to check), Git, and Claude Code (official setup guide: https://docs.claude.com/en/docs/claude-code/overview).
2. **Accounts.** Create or sign in to GitHub, Vercel, Supabase and the Claude Console (for an API key with credit; set a monthly spend limit). Resend is optional.
3. **Supabase project.** New project, region **Mumbai (ap-south-1)**. Save the database password. Then open **SQL Editor**, paste the whole of `supabase/migrations/0001_init.sql`, and press Run. You should see "Success. No rows returned".
4. **Keys.** In Supabase → Project Settings → API, copy the Project URL and the `service_role` key. In the Claude Console, create an API key.
5. **Project folder.** Make an empty folder called `rekrutly`, unzip this kit into it, then run:
   ```
   cd rekrutly
   git init
   cp .env.example .env.local
   ```
   Fill in `.env.local`. Generate the two secrets with `openssl rand -base64 32` (run it twice: one for `SESSION_SECRET`, one for `TOKEN_ENC_KEY`).
   Then `git add -A && git commit -m "chore: build kit"`.
6. **Let Claude Code see the browser.** Run once:
   ```
   claude mcp add playwright -- npx @playwright/mcp@latest
   ```
   This lets Claude Code open your app, click through it and take screenshots to check the design.
7. **Start Claude Code** in the folder: `claude`. Use the strongest model your plan offers (`/model`).

## How to run each prompt

1. Type `/clear` so the session starts fresh (CLAUDE.md reloads automatically).
2. Type: `Execute @docs/prompts/01-foundation.md` (change the number each time).
3. Claude Code will show a plan. Read it. If it matches the prompt, approve.
4. Let it build. It must finish by running `npm run verify`, checking the screen, updating `docs/PROGRESS.md`, and committing.
5. **You check too** (2 minutes): open the app, do the "You check" list at the bottom of the prompt. If something is wrong, use `docs/prompts/R1-fix-bug.md`.
6. Push to GitHub (`git push`). Vercel redeploys automatically after Prompt 01's setup.

Never run two prompts in one session. Never skip a prompt's verification. If a prompt takes more than 1.5× its time box, run `R3-behind-schedule.md`.

## The 48-hour schedule

| When | Prompt | What exists afterwards |
|---|---|---|
| H0–1.5 | 01 Foundation | App runs locally and on Vercel; `/api/health` shows the database is connected |
| H1.5–3 | 02 Data layer and seed | Demo jobs and candidates in the database; status, events and token helpers tested |
| H3–5.5 | 03 Access gate and UI kit | Passcode login; the Apple-clean frame and every component on `/styleguide` |
| H5.5–8 | 04 Overview, jobs, candidates | Real dashboard and candidate profiles |
| H8–11 | 05 Command Centre | Typing the demo sentence produces a validated plan |
| H11–13 | 06 Question builder | AI questions you can edit, regenerate, delete |
| H13–16 | 07 Approve and execute | Approval creates the assessment and candidate links; live Progress Rail. **Day 1 test** |
| H16–22 | Sleep | Tired debugging costs more than it saves |
| H22–25 | 08 Candidate portal | Real timed test in a second browser, autosave, submit |
| H25–28.5 | 09 Scoring and results | Real scores, evidence, overrides, interview questions |
| H28.5–31.5 | 10 War Room and follow-ups | Live progress, tasks, WhatsApp and email drafts in 3 languages |
| H31.5–35 | 11 Wow layer | Spotlight, voice, guardrail moment, Demo Director, saved fallbacks |
| H35–38 | 12 Analytics and compare | Charts and side-by-side evidence |
| **H38** | **Feature freeze** | Only fixes from here |
| H38–42 | 13 Hardening and tests | E2E golden path test, security and design audit |
| H42–45 | 14 Ship and demo | Deployed, verified, README, demo script rehearsed, backup video |
| H45–48 | Buffer | Rest |

## Day 1 test (after Prompt 07)

Log in → Command Centre → type the demo sentence → plan appears → Review questions → edit one → Approve → five candidate links appear → open one in an incognito window → the intro page loads.

## Day 2 test (after Prompt 09)

Candidate answers and submits in incognito → recruiter screen updates within seconds → results show a real score, skill bars and evidence.
