import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const DEMO_SENTENCE =
  'Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Cover React, APIs, SQL and debugging. Show me the questions before inviting anyone.';

/** With E2E_USE_FALLBACK=true the saved plan and questions are used, so the run does not depend on AI quota or speed. */
export const USE_FALLBACK = process.env.E2E_USE_FALLBACK === 'true';

export async function signIn(page: Page): Promise<void> {
  const passcode = process.env.RECRUITER_PASSCODE;
  if (!passcode) throw new Error('RECRUITER_PASSCODE is not set. Add it to .env.local.');
  await page.goto('/login');
  await page.getByLabel('Passcode').fill(passcode);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function resetDemo(request: APIRequestContext): Promise<void> {
  const res = await request.post('/api/demo/reset');
  expect(res.ok(), 'reset demo data (needs DEMO_MODE=true)').toBeTruthy();
}

/** Makes the browser send the saved plan and questions when the app asks the AI. The app itself is unchanged. */
export async function useSavedContent(page: Page): Promise<void> {
  await page.route('**/api/agent/plan', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.continue({ postData: JSON.stringify({ ...body, useSavedPlan: true }) });
  });
  await page.route('**/api/runs/*/questions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.continue({ postData: JSON.stringify({ useSaved: true }) });
  });
}

type Live = { data: { assessment: { id: string } | null; invitations: { id: string; name: string }[]; run: { status: string } } };

/** Reads the run's live data and waits until its candidate links exist. */
export async function waitForLinks(request: APIRequestContext, runId: string, count = 5): Promise<Live['data']> {
  let live: Live['data'] | null = null;
  await expect.poll(async () => {
    const res = await request.get(`/api/runs/${runId}/live`);
    if (!res.ok()) return 0;
    live = ((await res.json()) as Live).data;
    return live.invitations.length;
  }, { timeout: 120_000, intervals: [2000] }).toBeGreaterThanOrEqual(count);
  return live as unknown as Live['data'];
}

export async function candidateUrl(request: APIRequestContext, invitationId: string): Promise<string> {
  const res = await request.get(`/api/invitations/${invitationId}/link`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { data: { url: string } }).data.url;
}
