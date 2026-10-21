import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
