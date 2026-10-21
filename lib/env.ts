import 'server-only';
import { emailStatus, parseEnv, type Env } from './env-schema';

const parsed = parseEnv(process.env);
if (!parsed.ok) throw new Error(parsed.message);

export const env: Env = parsed.data;
export const isDemoMode: boolean = env.DEMO_MODE;
export const isEmailConfigured: boolean = emailStatus(env) === 'configured';
export { emailStatus };
