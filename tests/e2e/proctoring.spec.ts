import { expect, test } from '@playwright/test';
import { candidateUrl, DEMO_SENTENCE, resetDemo, signIn, USE_FALLBACK, useSavedContent, waitForLinks } from './helpers';

// Chromium's built-in fake camera, so no real camera is needed.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

test('proctored exam: consent and camera check, live alert, thumbnail, recording and review page', async ({ browser }) => {
  test.setTimeout(300_000);
  const recruiterCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const recruiter = await recruiterCtx.newPage();
  await signIn(recruiter);
  await resetDemo(recruiter.request);
  if (USE_FALLBACK) await useSavedContent(recruiter);

  await recruiter.goto('/command');
  await recruiter.getByLabel('Instruction for Rekrutly').fill(DEMO_SENTENCE);
  await recruiter.getByLabel('Instruction for Rekrutly').press('Enter');
  await expect(recruiter.getByRole('heading', { name: 'Plan' })).toBeVisible({ timeout: 120_000 });
  await recruiter.getByRole('link', { name: 'Write the questions' }).click();
  await expect(recruiter).toHaveURL(/\/runs\/[0-9a-f-]{36}/);
  const runId = /\/runs\/([0-9a-f-]{36})/.exec(recruiter.url())?.[1] as string;
  await expect(recruiter.getByRole('button', { name: 'Approve and create links' })).toBeVisible({ timeout: 180_000 });

  // The recruiter turns proctoring on, then approves.
  await recruiter.getByRole('checkbox', { name: /Record the candidate on camera/ }).check();
  await recruiter.getByRole('button', { name: 'Approve and create links' }).click();
  await expect(recruiter.getByRole('heading', { name: 'Candidate links' })).toBeVisible({ timeout: 120_000 });
  const live = await waitForLinks(recruiter.request, runId);
  const aarav = live.invitations.find((i) => i.name === 'Aarav Mehta') as { id: string };
  const url = await candidateUrl(recruiter.request, aarav.id);

  // Candidate: cannot start without agreeing to the camera and turning it on.
  const candidateCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, permissions: ['camera'] });
  const candidate = await candidateCtx.newPage();
  await candidate.goto(url);
  await expect(candidate.getByRole('heading', { name: 'Camera recording' })).toBeVisible();
  const start = candidate.getByRole('button', { name: 'Start assessment' });
  await candidate.getByRole('checkbox', { name: 'I understand' }).check();
  await expect(start).toBeDisabled();
  await candidate.getByRole('checkbox', { name: /I agree to be recorded/ }).check();
  await expect(start).toBeDisabled();
  await candidate.getByRole('button', { name: 'Turn on my camera' }).click();
  await expect(candidate.getByText('Camera is working.')).toBeVisible();
  if (process.env.E2E_SHOTS) await candidate.screenshot({ path: 'screenshots/proctor-consent.png', fullPage: true });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(candidate.getByRole('navigation', { name: 'Questions' })).toBeVisible();
  await expect(candidate.getByLabel('Your camera, being recorded')).toBeVisible();

  // After the first picture has gone up, the War Room shows a live thumbnail.
  await recruiter.goto(`/runs/${runId}/war-room`);
  await expect(recruiter.getByRole('heading', { name: 'Live alerts' })).toBeVisible();
  await expect(recruiter.getByAltText('Live camera for Aarav Mehta')).toBeVisible({ timeout: 30_000 });

  // A copy event becomes a live alert with a "Review this moment" link.
  await candidate.evaluate(() => document.dispatchEvent(new Event('copy')));
  await expect(recruiter.getByText('Aarav Mehta: copied text').first()).toBeVisible({ timeout: 20_000 });
  await expect(recruiter.getByRole('link', { name: 'Review this moment' }).first()).toBeVisible();
  if (process.env.E2E_SHOTS) { await recruiter.screenshot({ path: 'screenshots/proctor-warroom.png' }); await candidate.screenshot({ path: 'screenshots/proctor-candidate.png' }); }

  // Finish: the last piece of the recording is uploaded before the submission closes.
  for (let i = 0; i < 10; i++) {
    if (await candidate.getByRole('radiogroup', { name: 'Answer options' }).count()) await candidate.getByRole('radio').first().click();
    else await candidate.getByLabel('Your answer').fill('I would narrow the problem down to one cause, fix it, and add a test.');
    await candidate.getByRole('button', { name: /^(Next|Review and submit)$/ }).click();
  }
  await candidate.getByRole('button', { name: 'Submit assessment' }).click();
  await candidate.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(candidate.getByText('Submitted.')).toBeVisible({ timeout: 60_000 });
  await candidateCtx.close();

  // Review page: the recording plays and the flagged moment is on the timeline.
  await recruiter.goto(`/proctoring/${aarav.id}`);
  await expect(recruiter.getByRole('heading', { name: 'Moments to review' })).toBeVisible();
  await expect(recruiter.getByRole('button', { name: /Copied text/ }).first()).toBeVisible();
  await expect(recruiter.locator('video')).toBeVisible();
  if (process.env.E2E_SHOTS) await recruiter.screenshot({ path: 'screenshots/proctor-review.png' });

  await recruiterCtx.close();
});
