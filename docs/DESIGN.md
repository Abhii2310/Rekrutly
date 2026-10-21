# Rekrutly design system — "Quiet precision"

The product should feel like an Apple product page that happens to be a working tool: white space, confident type, one blue for actions, nothing decorative. Calm is the brand. A recruiter should feel in control the moment the page loads.

## Principles

1. **Type does the work.** Hierarchy comes from size and weight, not from boxes, borders or colour.
2. **One accent.** Blue `#0071E3` means "you can act here". Nothing else is blue.
3. **Colour is meaning.** Tints appear only on status pills and the AI mark. Everything else is grayscale.
4. **Fewer containers.** Group with whitespace and inset grouped lists (like iOS Settings). Do not wrap every block in a card.
5. **One signature moment.** The Progress Rail lighting up step by step as the agent works. All other motion is a quiet response to a click.
6. **Honest UI.** AI output always carries the AI mark. Simulated and demo data are labelled. Errors say what happened and what to do.

## Tokens (put in `app/globals.css` with Tailwind v4 `@theme`)

```css
@theme {
  --color-canvas: #FFFFFF;          /* page */
  --color-mist: #F5F5F7;            /* sidebar, grouped list background, subtle sections */
  --color-fog: #E8E8ED;             /* secondary button, input fill on hover */
  --color-ink: #1D1D1F;             /* primary text */
  --color-ink-2: #6E6E73;           /* secondary text */
  --color-ink-3: #86868B;           /* tertiary text, placeholders */
  --color-hairline: #D2D2D7;        /* borders, dividers (use 1px, or 0.5px on retina via scale) */
  --color-action: #0071E3;          /* buttons, links, focus ring */
  --color-action-hover: #0077ED;
  --color-ai: #5E5CE6;              /* AI provenance mark only */
  --color-ai-tint: #EEEEFC;
  --color-success: #248A3D;  --color-success-tint: #E9F6EC;
  --color-warning: #B25000;  --color-warning-tint: #FFF3E3;
  --color-danger:  #D70015;  --color-danger-tint:  #FFECEE;
  --color-neutral: #6E6E73;  --color-neutral-tint: #F2F2F4;

  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-inter), "Segoe UI", system-ui, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", var(--font-inter), "Segoe UI", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;

  --radius-control: 10px;   /* inputs */
  --radius-group: 14px;     /* grouped lists, panels */
  --radius-sheet: 18px;     /* dialogs, sheets, command palette */
  --ease-spring: cubic-bezier(0.32, 0.72, 0, 1);
}
```

Load Inter with `next/font/google` as the variable `--font-inter`. On Apple devices the system font (SF Pro) is used; elsewhere Inter takes over. Body text uses `font-feature-settings: "cv11", "ss01"` only for Inter; numbers in tables, scores and timers use `tabular-nums`.

## Type scale

| Role | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| Hero | 44 / 48 | 600 | -0.025em | Command Centre prompt line only |
| Large title | 32 / 38 | 600 | -0.02em | Page titles |
| Title | 22 / 28 | 600 | -0.015em | Section titles, candidate name in profile |
| Headline | 17 / 22 | 600 | -0.01em | List row titles, step titles |
| Body | 15 / 22 | 400 | -0.005em | Default |
| Callout | 13 / 18 | 400 | 0 | Secondary info, captions under titles |
| Footnote | 12 / 16 | 500 | 0 | Pills, tags, timestamps (smallest size allowed) |
| Stat | 40 / 44 | 600 | -0.03em | Numbers on Overview and results |

Weights: 400, 500, 600 only. Sentence case everywhere. Never all caps. Never colour or italicise a single word in a heading.

## Layout

- Sidebar 240px, background `mist`, no border; content area `canvas`.
- Content max width 1120px, centred, horizontal padding 40px (24px under 1024px, 16px on phones).
- Page header: large title, one-line callout under it in `ink-2`, actions right-aligned on the same baseline. 40px below the header before content.
- Vertical rhythm: 8px grid. Section gap 48px. Row height 56px in grouped lists.
- Sticky page header on scroll: `background: rgb(255 255 255 / 0.72); backdrop-filter: saturate(180%) blur(20px);` with a hairline bottom border that appears only after scrolling.
- Recruiter app is designed for laptop first, still usable at 768px. The candidate portal must be perfect on a phone.

```
┌────────────┬──────────────────────────────────────────────────────────┐
│ Rekrutly   │  Overview                                   [ New task ] │
│            │  3 open roles, 12 candidates                             │
│ Overview   │                                                          │
│ Command    │  12          4            68%          3                 │
│ Jobs       │  Candidates  In progress  Completion   Need you          │
│ Candidates │                                                          │
│ War Room   │  Needs your attention                                    │
│ Analytics  │  ┌──────────────────────────────────────────────────┐   │
│            │  │ Review Diya's submission            Waiting  ›    │   │
│            │  │ Rohan has no email                  Waiting  ›    │   │
│ Demo data  │  └──────────────────────────────────────────────────┘   │
└────────────┴──────────────────────────────────────────────────────────┘
```

Do not build meta strings joined by middle dots or spaced dashes anywhere. Write a short phrase or use columns.

## Components (build in `components/ui/`)

- **Button**: `primary` pill (radius 980px), `action` background, white text, 36px tall, 16px horizontal padding, 15px/500. `secondary` pill with `fog` background and `ink` text. `plain` text button in `action` colour. `destructive` plain text in `danger`. Focus: 3px ring `action` at 35% opacity with 2px offset. No icons inside buttons unless the icon is the whole meaning (mic, close). Never append arrows to labels.
- **Input / Textarea**: 44px tall, `mist` background, no border, radius `control`; on focus the background turns white with a 1px `action` border and the focus ring.
- **GroupedList / ListRow**: rounded `group` container on `mist` with white rows separated by hairlines inset 16px from the left. Row: title (headline), optional callout, right side value or pill, chevron for navigation. This replaces most cards.
- **Stat**: big number (Stat style) above a callout label. No box, no icon, no trend arrow unless the data supports it.
- **StatusPill**: footnote text, 22px tall, radius 980px, tinted background + dark text of the same tone, from `lib/status.ts`. Never more than one pill per row.
- **AIMark**: small 12px sparkle icon (lucide `Sparkles`) in `ai` colour + "Suggested by AI" footnote. Every AI-written item shows it. Hover/tap shows "Written by Rekrutly's AI. Review before you rely on it."
- **DemoTag / SimulatedTag**: neutral pill reading "Demo data" or "Simulated".
- **ProgressRail** (the signature): vertical list of steps. Each step: 20px circle + title (headline) + one line of detail (callout) + timestamp (footnote, right). States: planned = hairline circle; awaiting approval = circle with amber 2px ring and "Waiting for you"; executing = blue ring with a slow rotating arc; waiting = blue hairline circle with "Waiting for 3 of 5 candidates"; completed = filled `success` with a white check; failed = filled `danger` with "!" and an inline Retry button; skipped = hairline circle with strike-through-free callout "Skipped: email not configured". A 2px connector line between circles fills from gray to `success` as steps complete (300ms, `ease-spring`). New events slide in at 8px with opacity, 240ms.
- **Sheet**: right-side panel 560px, radius `sheet` on the left corners, used for candidate profile and evidence.
- **Dialog**: centred, radius `sheet`, one soft shadow `0 20px 60px rgb(0 0 0 / 0.18)`. The only other shadowed elements are popovers and the command palette.
- **Spotlight** (command palette, Cmd/Ctrl+K): 640px wide, 56px input with 20px text, results below in a grouped list. Background white, `backdrop` dims the page to `rgb(0 0 0 / 0.2)`.
- **Timer pill** (portal): tabular numbers, neutral; turns `warning` under 5 minutes and `danger` under 1 minute. Never flashes.
- **EmptyState**: one sentence of what this area will show + one primary button that creates it.
- **ErrorState**: what happened + what to do + Retry. No apologies.
- **Skeleton**: `mist` blocks at the exact size of the content they replace. No shimmer.
- **Avatar**: initials on `fog`, 32px. No photos, no generated faces.

## Screens

### Command Centre (`/command`) — the hero

```
            Tell Rekrutly what to do.
   ┌────────────────────────────────────────────────────┐
   │ Prepare a 30-minute full-stack developer…    (mic) │
   └────────────────────────────────────────────────────┘
   Try: "Prepare next hiring steps and draft follow-ups"   (plain links)

   Plan                                       Suggested by AI
   Full-stack assessment for 5 candidates, 10 questions, 30 min.
   ○ Write 10 questions                          Ready
   ○ Create assessment                           Waiting for you
   ○ Create 5 candidate links                    Waiting for you
   ○ Send invitations                            Email not configured
   ○ Track submissions
   ○ Score and prepare reports
   Assumptions: 10 questions (not stated).           [ Review questions ]
```
Hero line in the Hero style, centred, 120px from the top. The input is the largest control in the app. After submitting, the hero line animates up and shrinks to large-title size (one 350ms spring) and the plan appears under it.

### Review and approve (`/runs/[id]` in awaiting_approval)

Two columns at ≥1024px: left 2/3 is the question list (each question an editable grouped row: number, prompt, type, skill, difficulty; tap to expand options/rubric; Edit, Regenerate, Delete as plain buttons); right 1/3 is a sticky summary: duration stepper, recipients list (with "No email: link only" notes and an inline Add email field), invitation preview text, "What happens next" (derived from steps), and the primary button "Approve and create links". Cancel is a plain button below it.

### Run / War Room

Progress Rail on the left (360px), live content on the right: candidate progress rows in three aligned columns (name, "Question 4 of 10", "12:31 left"), then "Needs you" tasks, then the event timeline (receipts). Pause/Resume as a secondary button in the header.

### Candidate portal (`/a/[token]`)

```
 Rekrutly                                   18:42   ← timer pill
 ─────────────────────────────────────────────────  ← 2px progress line
                 Question 4 of 10      [SQL]   ← neutral pill

   Which index best speeds up this query?

   ◯  B-tree on (company_id, created_at)
   ◯  …

                       [ Back ]   [ Next ]
                                     Saved
```
White page, 640px centred column, 20px question text (Title style on desktop, 19px on phones), options as full-width 56px rows with a 1px hairline that turns `action` when selected. One question per screen. "Saved" appears in footnote after each autosave. Intro screen: role, duration, number of questions, the consent notice in plain words, and "Start assessment". Finish screen: "Submitted. You can close this page." with the submission time.

### Results and report

Header: candidate name (Title), job, submitted time. Then three stats: Objective score, Suggested AI score (with AI mark), Questions answered. Skill breakdown as horizontal bars (8px tall, rounded, `ink` fill on `fog` track, percentage at the right in tabular nums). Then question-by-question grouped list; tapping a short answer opens the evidence sheet: the answer with the evidence quote highlighted in `ai-tint`, matched and missing rubric points, reasoning, confidence, and "Override score" (requires a reason). Then "Suggested interview questions" with skill and "what good looks like". Print stylesheet hides the sidebar and buttons.

## Motion

- Durations 160–350ms, `ease-spring`. Only `transform` and `opacity`.
- User-triggered only, except the Progress Rail updates (which are real events).
- Respect `prefers-reduced-motion`: replace movement with instant state changes.

## Writing

- Plain verbs, sentence case: "Approve and create links", "Copy link", "Retry", "Override score". A button and its result use the same verb ("Approve" → toast "Approved").
- Name things the way a recruiter would: "candidate links", not "tokens"; "receipts" or "activity", not "events".
- Empty states invite action: "No assessments yet. Ask Rekrutly to create one."
- Errors: "Couldn't generate questions because the AI took too long. Retry, or use the saved demo set."

## Never

Gradients, glows, glassmorphism beyond the sticky header, drop shadows on cards, emoji, all-caps labels, small labels above every heading, identical cards in a grid, icons in every row, dark mode, a second accent colour, rainbow charts, placeholder lorem ipsum, stock photos.

## Review checklist (run on every screen before finishing a task)

1. Is there exactly one primary (blue pill) button visible? If two, demote one.
2. Can you remove one border, box or icon without losing meaning? Remove it.
3. Do all numbers use tabular figures and align?
4. Does every AI-written item show the AI mark?
5. Are loading, empty and error states designed, not default?
6. Is the text at least 12px everywhere and contrast at least 4.5:1 for body text?
7. Does it work at 375px wide (portal) and 1280px (recruiter)?
8. Keyboard: can you tab through everything with a visible focus ring?
9. Does it look calm in a screenshot? If anything shouts, quiet it.
