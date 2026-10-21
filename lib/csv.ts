/** Small, dependency-free CSV helpers. Pure, so they are easy to test. */

/** Parses CSV text (quotes, escaped quotes, commas and line breaks inside quotes, CRLF, a leading BOM). Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Spreadsheets run text that starts with = + - @ as a formula. A leading apostrophe makes it plain text. */
const guard = (s: string): string => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = guard(String(v));
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Writes rows as CSV with CRLF line ends, quoting where needed and guarding against spreadsheet formulas. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
