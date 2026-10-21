import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { loadEnv } from './db';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const path = process.argv.slice(2).find((a) => a.startsWith('/'));
  if (!path) {
    console.error('Usage: npm run screenshot -- <path> [--width 375] [--name x]');
    process.exit(1);
  }
  const width = Number(arg('width', '1280'));
  const name = arg('name') ?? (path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home');
  const base = process.env.PLAYWRIGHT_BASE_URL ?? env.APP_URL;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  if (!path.startsWith('/a/')) {
    const res = await context.request.post(`${base}/api/auth/login`, { data: { passcode: env.RECRUITER_PASSCODE } });
    if (!res.ok()) console.warn(`Sign-in returned ${res.status()} (expected until the access gate exists in Prompt 03).`);
  }
  const page = await context.newPage();
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  mkdirSync('screenshots', { recursive: true });
  const file = `screenshots/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  await browser.close();
  console.log(`Saved ${file}`);
}

void main();
