# Prompt 01 — Foundation

Time box: 90 minutes. Read `CLAUDE.md` (already loaded), `docs/ARCHITECTURE.md` sections 1 and 14, and the Tokens section of `docs/DESIGN.md`.

## Goal

A clean Next.js 16 project with the full toolchain, design tokens, validated environment, a server-only database client and a health check, ready to deploy. Nothing product-specific yet.

## Build

1. **Scaffold without touching the kit.** The folder already contains `CLAUDE.md`, `START-HERE.md`, `.env.example`, `docs/`, `supabase/`. Scaffold into a temporary folder and move it up:
   `npx create-next-app@latest .scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes`
   Move everything from `.scaffold/` into the root except any `CLAUDE.md` or `README.md` it created, then delete `.scaffold/`. If the scaffold created `AGENTS.md`, keep it in the root and append to our `CLAUDE.md` a final section `## Next.js agent notes` containing the single line `@AGENTS.md`.
2. **Dependencies.**
   - runtime: `@supabase/supabase-js zod ai @ai-sdk/anthropic motion lucide-react sonner server-only`
   - dev: `vitest @vitejs/plugin-react vite-tsconfig-paths @playwright/test tsx`
   Pin exact versions that installed (no `^`) in `package.json`.
3. **shadcn/ui.** `npx shadcn@latest init` (neutral base, CSS variables). Add only: `dialog sheet tooltip command dropdown-menu separator skeleton switch`. Do not restyle yet beyond mapping their CSS variables to our tokens.
4. **Design tokens.** Replace `app/globals.css` with the `@theme` tokens from DESIGN.md, a base layer setting `body` to `font-sans`, `text-ink`, `bg-canvas`, 15px/22px, `-webkit-font-smoothing: antialiased`, and `font-variant-numeric: tabular-nums` on `.tabular`. Map shadcn variables (`--background`, `--foreground`, `--primary`, `--ring`, `--border`, `--radius`, etc.) to our tokens so shadcn components inherit the look. Load Inter in `app/layout.tsx` via `next/font/google` as `--font-inter`. Set `<html lang="en">` and metadata title "Rekrutly".
5. **Environment.** `lib/env.ts` (`import 'server-only'`): Zod schema for every variable in ARCHITECTURE section 14. Required ones fail fast with a message naming the missing variable and where to get it. `TOKEN_ENC_KEY` must base64-decode to exactly 32 bytes. Export a typed `env` object and `isEmailConfigured`, `isDemoMode` helpers.
6. **Database client.** `lib/db/server.ts` (`import 'server-only'`): a singleton Supabase client using the service role key with `auth: { persistSession: false, autoRefreshToken: false }`.
7. **Health check.** `app/api/health/route.ts` returns `{ data: { db: 'ok' | 'error', ai: 'configured' | 'missing', email: 'configured' | 'not_configured', demoMode: boolean, time } }`. The DB check is a `select id from jobs limit 1`. No secrets in the response. `export const dynamic = 'force-dynamic'`.
8. **Temporary home page.** `app/page.tsx` shows "Rekrutly" in the Hero style, centred, with the callout "Foundation ready." (Prompt 03 replaces it.)
9. **Scripts** in `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `e2e` (`playwright test`), `verify` (`npm run typecheck && npm run lint && npm run test && npm run build`), `db:seed` (`tsx --env-file=.env.local scripts/seed.ts`).
10. **Testing setup.** `vitest.config.ts` with the tsconfig paths plugin and `environment: 'node'`, tests in `tests/unit/**/*.test.ts`. `playwright.config.ts` with `testDir: 'tests/e2e'`, `baseURL` from `PLAYWRIGHT_BASE_URL` or `http://localhost:3000`, and a `webServer` running `npm run dev` when no base URL is given. Write `tests/unit/env.test.ts` covering: valid env passes, missing key fails with a clear message, wrong-length `TOKEN_ENC_KEY` fails. (Make the schema importable without `server-only` side effects for tests, e.g. export `parseEnv(raw)` from a separate `lib/env-schema.ts`.)
11. **Hygiene.** `.gitignore` includes `.env*.local`, `.scaffold`, `test-results`, `playwright-report`. `tsconfig.json` has `"strict": true` and `"noUncheckedIndexedAccess": true`. Next config: `reactStrictMode: true`, `poweredByHeader: false`.

## Constraints

- Do not add any page, component or library not listed here.
- Do not create a `middleware.ts`; the access gate comes in Prompt 03 as `proxy.ts`.

## Verify (Claude Code)

- `npm run verify` passes.
- `npm run dev`, then `GET /api/health` returns `db: "ok"` (the migration was already run in Supabase). If it returns `error`, show the exact error and stop.
- Screenshot `/` with the Playwright MCP: one centred line of large text on white, system font on macOS.

## Finish

Update `docs/PROGRESS.md`, commit `chore: foundation (next 16, tokens, env, health)`. Then tell the user to:
1. Create a GitHub repo and `git push`.
2. Import it in Vercel, add every variable from `.env.local` (set `APP_URL` to the Vercel URL), deploy.
3. Open `<vercel-url>/api/health` and confirm `db: "ok"`.

## You check

- `/api/health` is ok locally and on Vercel.
- No `.env.local` in the GitHub repo.
