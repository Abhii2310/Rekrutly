import { getScriptDb, loadEnv } from './db';
import type { CandidateInsert, JobInsert } from '../lib/db/types';
import type { Stage } from '../lib/status';

const env = loadEnv();
const db = getScriptDb(env);

// Fixed IDs: saved demo fallbacks (Prompt 11) and bookmarks stay valid after every reset.
const jid = (n: number): string => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const cid = (n: number): string => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

const JOBS: (JobInsert & { id: string })[] = [
  {
    id: jid(1), title: 'Full-Stack Developer', team: 'Engineering', location: 'Bengaluru (hybrid)', employment_type: 'Full-time',
    description: 'Build and ship customer-facing features across a React front end and a Node.js API on PostgreSQL. You will own features from design to production, write tests, and debug issues in live systems alongside a small, senior team.',
    skills: ['React', 'TypeScript', 'Node.js', 'REST APIs', 'PostgreSQL', 'Debugging'], status: 'open', is_demo: true,
  },
  {
    id: jid(2), title: 'Product Designer', team: 'Design', location: 'Bengaluru', employment_type: 'Full-time',
    description: 'Design end-to-end flows for a B2B product, from research to high-fidelity prototypes. You will work directly with engineers and founders and shape the design system as it grows.',
    skills: ['Interaction design', 'Figma', 'User research', 'Prototyping'], status: 'open', is_demo: true,
  },
  {
    id: jid(3), title: 'Backend Engineer (Go)', team: 'Engineering', location: 'Remote (India)', employment_type: 'Full-time',
    description: 'Design and run Go services that handle high-volume event traffic. You will work on data modelling in PostgreSQL, service reliability and Kubernetes deployments.',
    skills: ['Go', 'PostgreSQL', 'Distributed systems', 'Kubernetes'], status: 'open', is_demo: true,
  },
];

type Seed = { n: number; job: number; stage: Stage; name: string; title: string; company: string; yrs: number; loc: string; skills: string[]; summary: string; email?: string | null };

const S: Seed[] = [
  // Full-Stack Developer: five candidates, all applied
  { n: 1, job: 1, stage: 'applied', name: 'Aarav Mehta', title: 'Frontend Engineer', company: 'Lumen Pay', yrs: 4, loc: 'Bengaluru',
    skills: ['React', 'TypeScript', 'Next.js', 'REST APIs'],
    summary: 'Built the merchant dashboard at Lumen Pay in React and TypeScript, cutting its load time by roughly 40%. Comfortable consuming and designing REST APIs, and keen to move toward full-stack work.',
    email: env.DEMO_CANDIDATE_EMAIL ?? 'aarav.mehta@example.com' },
  { n: 2, job: 1, stage: 'applied', name: 'Diya Raghunathan', title: 'Backend Engineer', company: 'Kestrel Logistics', yrs: 6, loc: 'Chennai',
    skills: ['Node.js', 'PostgreSQL', 'API design', 'Redis'],
    summary: 'Owns the shipment-tracking API at Kestrel Logistics, a Node.js service on PostgreSQL handling around two million events a day. Introduced Redis caching and query tuning that halved p95 latency.',
    email: 'diya.raghunathan@example.com' },
  { n: 3, job: 1, stage: 'applied', name: 'Kabir Shetty', title: 'Junior Developer', company: 'Brightloop', yrs: 2, loc: 'Mangaluru',
    skills: ['React', 'JavaScript', 'CSS'],
    summary: 'Builds marketing sites and small web apps in React at Brightloop, with a strong eye for responsive CSS. Learning backend development through side projects with Express.',
    email: 'kabir.shetty@example.com' },
  { n: 4, job: 1, stage: 'applied', name: 'Ishita Banerjee', title: 'Full-Stack Engineer', company: 'Orbitly', yrs: 5, loc: 'Pune',
    skills: ['React', 'Node.js', 'SQL', 'Docker'],
    summary: 'Full-stack engineer at Orbitly shipping React front ends and Node.js services, with Docker-based deployments. Led the migration of a reporting module from MongoDB to SQL.',
    email: 'ishita.banerjee@example.com' },
  { n: 5, job: 1, stage: 'applied', name: 'Rohan Nair', title: 'Software Engineer', company: 'Tidewater Labs', yrs: 3, loc: 'Kochi',
    skills: ['Python', 'Django', 'React', 'SQL'],
    summary: 'Works on a Django and React inventory platform at Tidewater Labs, writing most of its reporting queries in SQL. Has debugged several production incidents and wrote the team runbook for them.',
    email: null },
  // Product Designer: 2 applied, 2 interview, 1 offer, 1 rejected
  { n: 6, job: 2, stage: 'applied', name: 'Meera Joshi', title: 'UI Designer', company: 'Pixelcraft Studio', yrs: 3, loc: 'Mumbai',
    skills: ['Figma', 'Interaction design', 'Prototyping'],
    summary: 'Designs mobile app interfaces at Pixelcraft Studio, with a portfolio of fintech and travel apps. Builds interactive Figma prototypes for usability testing.', email: 'meera.joshi@example.com' },
  { n: 7, job: 2, stage: 'applied', name: 'Tanmay Deshpande', title: 'UX Designer', company: 'Fieldnote', yrs: 4, loc: 'Pune',
    skills: ['User research', 'Figma', 'Interaction design'],
    summary: 'Runs user interviews and usability studies for a field-service app at Fieldnote. Turns research findings into flows that the engineering team ships within a sprint.', email: 'tanmay.deshpande@example.com' },
  { n: 8, job: 2, stage: 'interview', name: 'Sanjana Iyer', title: 'Product Designer', company: 'Cobalt Health', yrs: 5, loc: 'Bengaluru',
    skills: ['Interaction design', 'Figma', 'User research', 'Prototyping'],
    summary: 'Led the redesign of the appointment-booking flow at Cobalt Health, which lifted completed bookings by a fifth. Maintains the shared component library with two engineers.', email: 'sanjana.iyer@example.com' },
  { n: 9, job: 2, stage: 'interview', name: 'Arjun Kulkarni', title: 'Senior Designer', company: 'Northwind Retail', yrs: 7, loc: 'Hyderabad',
    skills: ['Prototyping', 'Interaction design', 'Figma'],
    summary: 'Designs checkout and loyalty experiences at Northwind Retail for web and Android. Mentors two junior designers and runs the weekly design critique.', email: 'arjun.kulkarni@example.com' },
  { n: 10, job: 2, stage: 'offer', name: 'Lakshmi Venkataraman', title: 'Lead Product Designer', company: 'Saffron Foods', yrs: 8, loc: 'Chennai',
    skills: ['User research', 'Interaction design', 'Figma', 'Prototyping'],
    summary: 'Leads a team of three designers at Saffron Foods, owning the ordering app used by over a million customers. Introduced quarterly research sprints that shaped the product roadmap.', email: 'lakshmi.venkataraman@example.com' },
  { n: 11, job: 2, stage: 'rejected', name: 'Harpreet Gill', title: 'Graphic Designer', company: 'Brandbridge', yrs: 2, loc: 'Chandigarh',
    skills: ['Figma', 'Prototyping'],
    summary: 'Creates brand identities and social media assets at Brandbridge, mostly in Figma. Has limited experience with product research or interaction patterns for web apps.', email: 'harpreet.gill@example.com' },
  // Backend Engineer (Go): 2 applied, 1 under_review, 1 interview
  { n: 12, job: 3, stage: 'applied', name: 'Vikram Choudhury', title: 'Backend Developer', company: 'Gridline Telecom', yrs: 4, loc: 'Kolkata',
    skills: ['Go', 'PostgreSQL', 'Kubernetes'],
    summary: 'Writes Go microservices for billing events at Gridline Telecom, deployed on Kubernetes. Reduced PostgreSQL lock contention in the invoicing job by batching writes.', email: 'vikram.choudhury@example.com' },
  { n: 13, job: 3, stage: 'applied', name: 'Nandini Rao', title: 'Software Engineer', company: 'Streamly', yrs: 3, loc: 'Hubballi',
    skills: ['Go', 'Distributed systems', 'PostgreSQL'],
    summary: 'Works on the message-queue consumers behind Streamly\'s notification system, written in Go. Added idempotency keys that removed duplicate deliveries during retries.', email: 'nandini.rao@example.com' },
  { n: 14, job: 3, stage: 'under_review', name: 'Faisal Ahmed', title: 'Platform Engineer', company: 'Quarry Data', yrs: 6, loc: 'Hyderabad',
    skills: ['Kubernetes', 'Go', 'Distributed systems', 'PostgreSQL'],
    summary: 'Runs the Kubernetes platform for the data pipelines at Quarry Data and writes its Go operators. Designed the failover process that brought recovery time under two minutes.', email: 'faisal.ahmed@example.com' },
  { n: 15, job: 3, stage: 'interview', name: 'Anjali Menon', title: 'Senior Backend Engineer', company: 'Harbor Commerce', yrs: 7, loc: 'Thiruvananthapuram',
    skills: ['Go', 'Distributed systems', 'PostgreSQL', 'Kubernetes'],
    summary: 'Architected the order-routing service at Harbor Commerce in Go, processing peak loads of several thousand orders per second. Mentors the backend team on testing and observability.', email: 'anjali.menon@example.com' },
];

async function run(label: string, p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function main(): Promise<void> {
  // Reset deletes every demo run, assessment, invitation and submission, including ones created by hand in DEMO_MODE.
  // Fixed seeded UUIDs keep saved fallbacks valid. Rows with is_demo = false are never touched.
  await run('delete demo runs', db.from('workflow_runs').delete().eq('is_demo', true));
  // Old seed receipts have no run or job, so they would pile up on the Overview. Remove only those.
  await run('delete old seed receipts', db.from('workflow_events').delete().eq('type', 'system.seeded'));
  await run('delete demo jobs', db.from('jobs').delete().eq('is_demo', true));

  await run('insert jobs', db.from('jobs').insert(JOBS));

  const candidates: CandidateInsert[] = S.map((s) => ({
    id: cid(s.n),
    job_id: jid(s.job),
    full_name: s.name,
    email: s.email ?? null,
    phone: s.n === 1 ? (env.DEMO_CANDIDATE_WHATSAPP ?? null) : null,
    current_title: s.title,
    current_company: s.company,
    years_experience: s.yrs,
    location: s.loc,
    skills: s.skills,
    resume_summary: s.summary,
    source: 'Demo data',
    stage: s.stage,
    is_demo: true,
  }));
  await run('insert candidates', db.from('candidates').insert(candidates));

  const summary = JOBS.map((j) => ({
    job: j.title,
    candidates: candidates.filter((c) => c.job_id === j.id).length,
    stages: Object.entries(
      candidates.filter((c) => c.job_id === j.id).reduce<Record<string, number>>((a, c) => ({ ...a, [c.stage ?? 'applied']: (a[c.stage ?? 'applied'] ?? 0) + 1 }), {}),
    ).map(([k, v]) => `${v} ${k}`).join(', '),
  }));
  console.table(summary);

  await run('log event', db.from('workflow_events').insert({
    type: 'system.seeded', actor: 'system', level: 'success',
    message: `Seeded ${JOBS.length} demo jobs and ${candidates.length} candidates`,
    data: { jobs: JOBS.length, candidates: candidates.length },
  }));
  console.log(`Seeded ${JOBS.length} jobs and ${candidates.length} candidates.`);
}

main().catch((e: unknown) => {
  console.error('Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
