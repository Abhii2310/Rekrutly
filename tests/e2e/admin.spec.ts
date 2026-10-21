import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { DEMO_SENTENCE, resetDemo, signIn, waitForLinks } from './helpers';

const ROLE = `E2E role ${Date.now()}`;

// The role created below is a real (not demo) role, so a demo reset keeps it. Remove it afterwards.
test.afterAll(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await createClient(url, key, { auth: { persistSession: false } }).from('jobs').delete().like('title', 'E2E role %');
});

test('admin: create a role, import candidates from CSV, read the receipts, export and delete a candidate', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page);
  await resetDemo(page.request);

  // Create a role.
  await page.goto('/jobs');
  await page.getByRole('button', { name: 'New role' }).click();
  await page.getByLabel('Role title').fill(ROLE);
  await page.getByLabel('Skills').fill('SQL, Python');
  await page.getByRole('button', { name: 'Create role' }).click();
  await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name: ROLE })).toBeVisible();

  // Import candidates: one bad email and one good row without an email, plus a duplicate name.
  await page.getByRole('button', { name: 'Import CSV' }).click();
  await page.getByLabel('CSV text').fill('name,email,skills\nAsha Rao,asha.e2e@example.com,SQL; Python\nBad Row,not-an-email,\nRavi Kumar,,Excel');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Imported 2. Skipped 1.')).toBeVisible();
  await expect(page.getByText('Row 3: Email is not valid.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('link', { name: /Asha Rao/ })).toBeVisible();

  // The receipts say so, and the export is a real CSV.
  await page.goto('/activity?group=admin');
  await expect(page.getByText(`Imported 2 candidates into ${ROLE}`)).toBeVisible();
  const csv = await page.request.get('/api/activity/export?group=admin');
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain('Created the role');

  // Privacy: a candidate who has a link, answers or scores can be exported and then deleted with everything about them.
  const plan = await page.request.post('/api/agent/plan', { data: { instruction: DEMO_SENTENCE, useSavedPlan: true } });
  const { runId, plan: p } = (await plan.json()).data as { runId: string; plan: { candidates: { id: string }[] } };
  expect((await page.request.post(`/api/runs/${runId}/questions`, { data: { useSaved: true } })).ok()).toBeTruthy();
  expect((await page.request.post(`/api/runs/${runId}/approve`, { data: { durationMinutes: 30, recipientIds: p.candidates.map((c) => c.id) } })).ok()).toBeTruthy();
  const live = await waitForLinks(page.request, runId);
  const aarav = live.invitations.find((i) => i.name === 'Aarav Mehta');
  const candidateId = p.candidates[0]?.id as string;
  expect(aarav).toBeTruthy();

  const exp = await page.request.get(`/api/candidates/${candidateId}/export`);
  expect(exp.status()).toBe(200);
  const data = await exp.json();
  expect(data.candidate.id).toBe(candidateId);
  expect(JSON.stringify(data)).not.toMatch(/token|correct_option|rubric/);

  expect((await page.request.delete(`/api/candidates/${candidateId}`, { data: {} })).status()).toBe(400);
  expect((await page.request.delete(`/api/candidates/${candidateId}`, { data: { confirm: true } })).status()).toBe(200);
  expect((await page.request.get(`/api/candidates/${candidateId}/export`)).status()).toBe(404);
  const safety = await (await page.request.get('/api/activity/export?group=safety')).text();
  expect(safety).toContain('Deleted a candidate and their data at their request');

  // Settings: status and the AI check are there.
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('Connected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Test the AI' })).toBeVisible();

  await ctx.close();
});
