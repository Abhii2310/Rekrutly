/** Pure. Reads a name and an email from resume text, with the file name as a fallback. Wrong guesses are fixed in the profile. */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
const HEADINGS = /(resume|curriculum|vitae|\bcv\b|profile|contact|summary|objective|experience|education|skills|address|phone|email|linkedin|github|portfolio)/i;

const titleCase = (s: string): string => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());

function nameFromFile(file: string): string | null {
  const base = file.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').replace(/\b(resume|cv|curriculum|vitae|final|updated|new|copy|\d+)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const words = base.split(' ').filter(Boolean);
  return words.length >= 1 && words.length <= 4 && /^[A-Za-z .'-]+$/.test(base) ? titleCase(base) : null;
}

export type Identity = { name: string; email: string | null };

export function parseIdentity(text: string, fileName: string): Identity {
  const email = EMAIL.exec(text)?.[0]?.toLowerCase() ?? null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    if (line.length > 40 || EMAIL.test(line) || /\d/.test(line) || HEADINGS.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w))) continue;
    // "ASHA RAO" and "Asha Rao" are names; "senior product designer" is not capitalised like one.
    if (words.every((w) => /^[A-Z]/.test(w)) || words.every((w) => w === w.toUpperCase())) return { name: titleCase(line), email };
  }
  return { name: nameFromFile(fileName) ?? (email ? titleCase((email.split('@')[0] ?? '').replace(/[._0-9-]+/g, ' ').trim()) || 'New candidate' : 'New candidate'), email };
}
