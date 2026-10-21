import { loadEnv } from './db';
import { listModels } from './models';
import type { AiProvider } from '../lib/env-schema';

async function main(): Promise<void> {
  const env = loadEnv();
  const providers = [env.AI_PROVIDER, env.AI_FALLBACK_PROVIDER].filter((p): p is AiProvider => Boolean(p));
  let failed = false;
  for (const p of providers) {
    try {
      const { ids } = await listModels(env, p);
      console.log(`\n${p}: ${ids.length} text models`);
      for (const id of ids.sort()) console.log(`  ${id}`);
    } catch (e) {
      failed = true;
      console.error(`\n${p}: ${(e as Error).message}`);
    }
  }
  if (failed) process.exit(1);
}

void main();
