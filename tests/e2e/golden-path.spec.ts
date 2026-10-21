import { expect, test } from '@playwright/test';
import { candidateUrl, DEMO_SENTENCE, resetDemo, signIn, USE_FALLBACK, useSavedContent, waitForLinks } from './helpers';

test('golden path: plan, questions, approve, candidate submits, recruiter sees the evidence', async ({ browser }) => {
  const recruiterCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const recruiter = await recruiterCtx.newPage();

  // Sign in, then start from clean demo data.
  await signIn(recruiter);
  await resetDemo(recruiter.request);
  if (USE_FALLBACK) await useSavedContent(recruiter);

  // 1. Command Centre: the demo sentence gives a plan with five candidates.
  await recruiter.goto('/command');
  await recruiter.getByLabel('Instruction for Rekrutly').fill(DEMO_SENTENCE);
  await recruiter.getByLabel('Instruction for Rekrutly').press('Enter');
  await expect(recruiter.getByRole('heading', { name: 'Plan' })).toBeVisible({ timeout: 120_000 });
  await expect(recruiter.getByText(/5 candidates/)).toBeVisible();

  // 2. Write the questions.
  await recruiter.getByRole('link', { name: 'Write the questions' }).click();
  await expect(recruiter).toHaveURL(/\/runs\/[0-9a-f-]{36}/);
  const runId = /\/runs\/([0-9a-f-]{36})/.exec(recruiter.url())?.[1] as string;
  await expect(recruiter.getByRole('button', { name: 'Approve and create links' })).toBeVisible({ timeout: 180_000 });

  // 3. Edit question 1.
  await recruiter.getByRole('button', { name: 'Show details' }).first().click();
  await recruiter.getByRole('button', { name: 'Edit', exact: true }).first().click();
  const edited = 'Which hook runs code after a component has rendered? (checked by the e2e test)';
  await recruiter.getByLabel('Question', { exact: true }).fill(edited);
  await recruiter.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(recruiter.getByText('Edited').first()).toBeVisible();

  // 4. Approve.
  await recruiter.getByRole('button', { name: 'Approve and create links' }).click();
  await expect(recruiter.getByRole('heading', { name: 'Candidate links' })).toBeVisible({ timeout: 120_000 });
  const live = await waitForLinks(recruiter.request, runId);
  const aarav = live.invitations.find((i) => i.name === 'Aarav Mehta');
  expect(aarav, 'Aarav has a candidate link').toBeTruthy();

  // 5. Copy Aarav's link (the clipboard may be blocked in a test browser, so the URL itself comes from the API).
  await recruiter.getByRole('button', { name: 'Copy link' }).first().click();
  const url = await candidateUrl(recruiter.request, (aarav as { id: string }).id);
  expect(url).toMatch(/\/a\/[A-Za-z0-9_-]{43}$/);

  // 6. A separate browser context, phone width: consent, answer everything, submit.
  const candidateCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const candidate = await candidateCtx.newPage();
  await candidate.goto(url);
  await expect(candidate.getByRole('heading', { name: 'Hi Aarav.' })).toBeVisible();
  await candidate.getByRole('checkbox').check();
  await candidate.getByRole('button', { name: 'Start assessment' }).click();

  for (let i = 0; i < 10; i++) {
    await expect(candidate.getByRole('navigation', { name: 'Questions' })).toBeVisible();
    if (await candidate.getByRole('radiogroup', { name: 'Answer options' }).count()) {
      await candidate.getByRole('radio').first().click();
    } else {
      await candidate.getByLabel('Your answer').fill('I would look at the evidence first, narrow the problem down to one cause, fix it, and add a test so it cannot return.');
    }
    await candidate.getByRole('button', { name: /^(Next|Review and submit)$/ }).click();
  }
  await candidate.getByRole('button', { name: 'Submit assessment' }).click();
  await candidate.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(candidate.getByText('Submitted.')).toBeVisible({ timeout: 60_000 });
  await candidateCtx.close();

  // 7. Recruiter: the results row shows a score within 60 seconds, then the evidence sheet opens.
  const assessmentId = live.assessment?.id as string;
  await recruiter.goto(`/assessments/${assessmentId}/results`);
  const row = recruiter.getByRole('link', { name: /Aarav Mehta/ });
  await expect(row).toContainText(/\d+%/, { timeout: 60_000 });
  await row.click();
  await expect(recruiter.getByRole('heading', { name: 'Aarav Mehta' })).toBeVisible();

  // Written answers are graded in the background; give them time, and press Retry once if the AI was rate limited.
  const evidence = recruiter.getByRole('button', { name: /open the evidence/ }).first();
  try {
    await expect(evidence).toBeVisible({ timeout: 90_000 });
  } catch {
    const retry = recruiter.getByRole('button', { name: /Retry/ }).first();
    if (await retry.count()) await retry.click();
    await expect(evidence).toBeVisible({ timeout: 120_000 });
  }
  await evidence.click();
  await expect(recruiter.getByRole('dialog').getByText('Suggested by AI').first()).toBeVisible();

  await recruiterCtx.close();
});
