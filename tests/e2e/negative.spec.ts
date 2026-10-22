import { expect, test, request as pwRequest } from '@playwright/test';
import { DEMO_SENTENCE, resetDemo, signIn, waitForLinks } from './helpers';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

test.describe('signed out (only when REQUIRE_PASSCODE=true)', () => {
  test.skip(process.env.REQUIRE_PASSCODE !== 'true', 'The app is open by default, so there is nothing to sign in to.');
  test('recruiter pages send you to sign in and keep where you were going', async ({ page }) => {
    for (const path of ['/jobs', '/candidates', '/command', '/analytics', '/war-room', '/demo']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    await page.goto('/jobs');
    await expect(page).toHaveURL(/next=%2Fjobs/);
  });

  test('the root address shows the public landing page, not the app', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Hire with the lights on.' })).toBeVisible();
    await page.getByRole('link', { name: 'Sign in' }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('recruiter APIs answer 401 with the standard error shape', async () => {
    const api = await pwRequest.newContext({ baseURL });
    const id = '11111111-1111-4111-8111-111111111111';
    const calls: [string, string][] = [
      ['GET', `/api/runs/${id}/live`], ['POST', '/api/agent/plan'], ['POST', `/api/runs/${id}/approve`], ['PATCH', `/api/tasks/${id}`],
      ['POST', '/api/demo/reset'], ['GET', '/api/spotlight'], ['GET', `/api/invitations/${id}/link`], ['PATCH', `/api/question-scores/${id}`],
    ];
    for (const [method, path] of calls) {
      const res = await api.fetch(path, { method, data: method === 'GET' ? undefined : {} });
      expect(res.status(), `${method} ${path}`).toBe(401);
      expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: expect.any(String) } });
    }
    await api.dispose();
  });
});

test.describe('candidate links', () => {
  test('an invalid link shows a calm screen and never reaches the database', async ({ page, request }) => {
    // Warm the route first: in a dev server the first request compiles it, which can outlast the page's own timeout.
    await request.get(`/api/c/${'x'.repeat(43)}`);
    await page.goto(`/a/${'x'.repeat(43)}`);
    await expect(page.getByText("This link isn't valid.")).toBeVisible();
    await page.goto('/a/short');
    await expect(page.getByText("This link isn't valid.")).toBeVisible();
    for (const t of ['short', 'x'.repeat(43), 'a'.repeat(200)]) {
      const res = await request.get(`/api/c/${t}`);
      expect(res.status()).toBe(404);
    }
  });

  test('a second submit is refused and answers cannot be changed afterwards', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page);
    await resetDemo(page.request);

    // Plan, questions and approval through the API, with the saved content so this does not depend on AI.
    const plan = await page.request.post('/api/agent/plan', { data: { instruction: DEMO_SENTENCE, useSavedPlan: true } });
    expect(plan.ok()).toBeTruthy();
    const { runId, plan: p } = (await plan.json()).data as { runId: string; plan: { candidates: { id: string }[] } };
    expect((await page.request.post(`/api/runs/${runId}/questions`, { data: { useSaved: true } })).ok()).toBeTruthy();
    const approve = await page.request.post(`/api/runs/${runId}/approve`, { data: { durationMinutes: 30, recipientIds: p.candidates.map((c) => c.id) } });
    expect(approve.ok()).toBeTruthy();
    const live = await waitForLinks(page.request, runId);
    const inv = live.invitations.find((i) => i.name === 'Diya Raghunathan') as { id: string };
    const link = await (await page.request.get(`/api/invitations/${inv.id}/link`)).json();
    const token = (link.data.url as string).split('/a/')[1] as string;

    // The candidate has no cookies at all.
    const candidate = await pwRequest.newContext({ baseURL });
    expect((await candidate.post(`/api/c/${token}/start`, { data: { consent: true } })).ok()).toBeTruthy();
    const qs = (await (await candidate.get(`/api/c/${token}/questions`)).json()).data.questions as { id: string; type: string }[];
    // Candidate responses never carry answer keys.
    expect(JSON.stringify(qs)).not.toMatch(/correct_option|rubric|model_answer|explanation/);
    const first = qs[0] as { id: string };
    expect((await candidate.put(`/api/c/${token}/answers`, { data: { questionId: first.id, selectedOption: 1, currentQuestion: 1 } })).ok()).toBeTruthy();

    const submit1 = await candidate.post(`/api/c/${token}/submit`, { data: {} });
    expect(submit1.status()).toBe(200);
    const submit2 = await candidate.post(`/api/c/${token}/submit`, { data: {} });
    expect(submit2.status()).toBe(409);
    expect((await submit2.json()).error.code).toBe('already_submitted');
    const late = await candidate.put(`/api/c/${token}/answers`, { data: { questionId: first.id, selectedOption: 2, currentQuestion: 1 } });
    expect(late.status()).toBe(409);

    await candidate.dispose();
    await ctx.close();
  });
});
