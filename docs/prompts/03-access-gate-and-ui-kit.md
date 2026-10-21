# Prompt 03 — Access gate and UI kit

Time box: 2.5 hours. Read `docs/DESIGN.md` completely and `docs/ARCHITECTURE.md` section 8. This prompt sets the visual quality of the whole product. Take the design seriously.

## Goal

A passcode-protected recruiter area with the Apple-clean frame, and every UI primitive built once, correctly, and shown on a styleguide page.

## Build

### Access gate
1. `lib/security/session.ts`: `createSessionValue(now)`, `verifySessionValue(value, now)` using HMAC-SHA256 with `SESSION_SECRET` and `crypto.timingSafeEqual`; 7-day expiry. Unit tests: valid, expired, tampered signature, malformed.
2. `POST /api/auth/login` (Zod body `{ passcode }`, timing-safe compare, sets `rk_session` httpOnly, secure in production, sameSite lax, path `/`), `POST /api/auth/logout` (clears it). Add a 500ms delay on wrong passcode.
3. `proxy.ts` (export `proxy` and `config.matcher`): allow `/login`, `/api/auth/*`, `/a/*`, `/api/c/*`, `/api/health`, `_next/*`, `favicon.ico`; everything else requires a valid session. Pages redirect to `/login?next=<path>`; API routes get `401 { error: { code: 'unauthorized' } }`.
4. `lib/security/require-recruiter.ts`: helper used at the top of every recruiter route handler (defence in depth).
5. `app/(auth)/login/page.tsx`: white page, centred 360px column, the word "Rekrutly" in Large title, callout "Enter the team passcode.", one passcode input, primary button "Sign in", inline error "That passcode isn't right." No logo image.

### UI kit (`components/ui/`)
Build each primitive exactly as specified in DESIGN.md → Components, using the tokens: `Button` (primary, secondary, plain, destructive; sizes sm/md; loading state that keeps width), `Input`, `Textarea` (auto-grow), `SegmentedControl`, `StatusPill` (takes a status kind + value and reads `lib/status.ts`), `AIMark`, `DemoTag`, `SimulatedTag`, `GroupedList` + `ListRow` (title, subtitle, value, pill, chevron, href or onClick), `Stat`, `PageHeader` (title, description, actions, sticky blur behaviour after 8px scroll), `EmptyState`, `ErrorState` (message, hint, onRetry), `Skeleton`, `Avatar` (initials), `Kbd`, `ProgressRail` (all step states from DESIGN.md, including the connector fill and the slow rotating arc for executing; respects reduced motion), `Toaster` (sonner, restyled: white, radius sheet, single soft shadow, 13px text). Restyle shadcn `Dialog`, `Sheet`, `Tooltip`, `DropdownMenu`, `Command` to DESIGN.md.

### Frame
6. `app/(recruiter)/layout.tsx`: 240px `mist` sidebar with the wordmark "Rekrutly" (17px/600), nav items Overview, Command, Jobs, Candidates, War Room, Analytics (lucide icons at 18px, stroke 1.75; active item has white background, radius 8px, ink text; inactive ink-2), and at the bottom a `DemoTag` when `DEMO_MODE` plus a plain "Sign out" button. Content column per DESIGN.md layout. Collapsible to an icon rail under 1024px.
7. Placeholder pages for each nav item using `PageHeader` + `EmptyState` (honest copy, e.g. "Analytics will appear once candidates complete assessments."). Overview is built in Prompt 04.
8. `app/(recruiter)/styleguide/page.tsx` (only when `DEMO_MODE`): every primitive in every state, including a ProgressRail showing all seven step states, StatusPills for every status in `lib/status.ts`, empty, error and loading examples.
9. Global `app/not-found.tsx` and `app/(recruiter)/error.tsx` using `ErrorState`.

## Constraints

- No component may use a raw hex colour; tokens only.
- Every interactive element has a visible focus ring and an accessible name.
- Do not add icons to rows or buttons beyond what DESIGN.md allows.

## Verify (Claude Code)

- `npm run verify` passes; session tests included.
- Playwright MCP: visiting `/` while signed out redirects to `/login`; wrong passcode shows the error; right passcode lands on Overview; `/a/test` is not redirected (404 is fine); `/api/jobs` style recruiter API returns 401 when signed out.
- Screenshot `/styleguide` at 1280px and walk the DESIGN.md review checklist item by item. Fix every failure, screenshot again, and include a short list of what you fixed in your report.

## Finish

Update PROGRESS.md, commit `feat(ui): access gate, frame, Apple-clean UI kit, styleguide`.

## You check

Open `/styleguide`. It should feel calm: lots of white, one blue, readable type, nothing shouting. If anything looks generic, run `R2-design-polish.md` on it now — this is the cheapest moment to fix the look.
