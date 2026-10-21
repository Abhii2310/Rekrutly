/** Fixed IDs for the seeded demo data. Saved fallbacks and bookmarks stay valid after every reset. */
export const jid = (n: number): string => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
export const cid = (n: number): string => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

export const DEMO_JOB_ID = jid(1);
/** The five Full-Stack Developer candidates the golden path uses. */
export const DEMO_CANDIDATE_IDS: readonly string[] = [1, 2, 3, 4, 5].map(cid);
