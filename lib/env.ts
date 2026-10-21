import 'server-only';
import { emailStatus, parseEnv, type Env } from './env-schema';

const parsed = parseEnv(process.env);
if (!parsed.ok) throw new Error(parsed.message);

export const env: Env = parsed.data;
export { emailStatus };
