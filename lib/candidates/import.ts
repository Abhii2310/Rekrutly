import { z } from 'zod';
import { parseCsv } from '@/lib/csv';

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_BYTES = 200_000;

export type ImportedCandidate = {
  full_name: string; email: string | null; phone: string | null; current_title: string | null; current_company: string | null;
  years_experience: number | null; location: string | null; skills: string[];
};
export type ImportResult = { rows: ImportedCandidate[]; skipped: { row: number; reason: string }[]; error?: string };

// Header names people actually use, mapped to our fields.
const ALIASES: Record<keyof ImportedCandidate, string[]> = {
  full_name: ['name', 'full name', 'fullname', 'candidate', 'candidate name'],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'mobile', 'whatsapp', 'phone number', 'contact'],
  current_title: ['title', 'role', 'current title', 'job title', 'position'],
  current_company: ['company', 'current company', 'employer', 'organisation', 'organization'],
  years_experience: ['years', 'experience', 'years of experience', 'yrs'],
  location: ['location', 'city'],
  skills: ['skills', 'skill'],
};

const norm = (h: string): string => h.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

const Row = z.object({
  full_name: z.string().trim().min(2, 'Name needs at least 2 characters.').max(120, 'Name is too long.'),
  email: z.string().trim().max(200).pipe(z.email('Email is not valid.')).nullable(),
  phone: z.string().trim().max(30).nullable(),
  current_title: z.string().trim().max(120).nullable(),
  current_company: z.string().trim().max(120).nullable(),
  years_experience: z.number().min(0, 'Years cannot be negative.').max(60, 'Years looks too high.').nullable(),
  location: z.string().trim().max(120).nullable(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
});

/** `existingEmails` and `existingNames` (lower case) are what the job already has. Pure. Turns pasted or uploaded CSV text into valid candidates and a list of rows that were skipped, with the reason. */
export function parseCandidateCsv(text: string, existingEmails: ReadonlySet<string> = new Set(), existingNames: ReadonlySet<string> = new Set()): ImportResult {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return { rows: [], skipped: [], error: 'That file is too large. Import up to 200 candidates at a time.' };
  const table = parseCsv(text);
  const header = table[0];
  if (!header) return { rows: [], skipped: [], error: 'The file is empty.' };
  const index = new Map<keyof ImportedCandidate, number>();
  header.forEach((h, i) => {
    for (const [field, names] of Object.entries(ALIASES) as [keyof ImportedCandidate, string[]][]) {
      if (!index.has(field) && names.map(norm).includes(norm(h))) index.set(field, i);
    }
  });
  if (!index.has('full_name')) return { rows: [], skipped: [], error: 'The first row needs a "name" column. Other columns: email, phone, title, company, years, location, skills.' };
  const body = table.slice(1);
  if (body.length === 0) return { rows: [], skipped: [], error: 'The file has a header but no candidates.' };
  if (body.length > MAX_IMPORT_ROWS) return { rows: [], skipped: [], error: `Import up to ${MAX_IMPORT_ROWS} candidates at a time. This file has ${body.length}.` };

  const seen = new Set(existingEmails);
  // People without an email can only be matched by name, so a name already in the job (with no email) is not added twice.
  const seenNames = new Set(existingNames);
  const rows: ImportedCandidate[] = [];
  const skipped: ImportResult['skipped'] = [];
  body.forEach((cells, n) => {
    const get = (f: keyof ImportedCandidate): string => (cells[index.get(f) ?? -1] ?? '').trim();
    const years = get('years_experience');
    const yearsMatch = /^\s*(\d+(?:\.\d+)?)/.exec(years);
    const rowNumber = n + 2; // the header is row 1
    if (years !== '' && !yearsMatch) return skipped.push({ row: rowNumber, reason: 'Years is not a number.' });
    const parsed = Row.safeParse({
      full_name: get('full_name'),
      email: get('email') || null,
      phone: get('phone') || null,
      current_title: get('current_title') || null,
      current_company: get('current_company') || null,
      years_experience: yearsMatch ? Number(yearsMatch[1]) : null,
      location: get('location') || null,
      // Skills are separated by semicolons or pipes, because commas separate the columns.
      skills: get('skills').split(/[;|]/).map((s) => s.trim()).filter(Boolean),
    });
    if (!parsed.success) return skipped.push({ row: rowNumber, reason: parsed.error.issues[0]?.message ?? 'This row is not valid.' });
    const email = parsed.data.email?.toLowerCase() ?? null;
    if (email && seen.has(email)) return skipped.push({ row: rowNumber, reason: 'Already in this job (same email).' });
    if (email) seen.add(email);
    else {
      const key = parsed.data.full_name.toLowerCase();
      if (seenNames.has(key)) return skipped.push({ row: rowNumber, reason: 'Already in this job (same name, no email).' });
      seenNames.add(key);
    }
    rows.push({ ...parsed.data, email: parsed.data.email });
  });
  return { rows, skipped };
}
