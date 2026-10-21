import { describe, expect, it } from 'vitest';
import { parseCandidateCsv } from '@/lib/candidates/import';
import { parseCsv, toCsv } from '@/lib/csv';

describe('parseCsv', () => {
  it('handles quotes, commas and line breaks inside quotes, CRLF, BOM and blank lines', () => {
    const text = '﻿name,notes\r\n"Doe, Jane","said ""hi""\nthen left"\r\n\r\nSam,plain\r\n';
    expect(parseCsv(text)).toEqual([['name', 'notes'], ['Doe, Jane', 'said "hi"\nthen left'], ['Sam', 'plain']]);
  });
  it('keeps empty cells and a last row without a line end', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
    expect(parseCsv('')).toEqual([]);
  });
});

describe('toCsv', () => {
  it('quotes where needed and writes CRLF', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], [1, null]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n1,\r\n');
  });
  it('defuses spreadsheet formulas', () => {
    expect(toCsv(['v'], [['=HYPERLINK("x")'], ['+1'], ['-2'], ['@cmd'], ['fine']])).toBe('v\r\n"\'=HYPERLINK(""x"")"\r\n\'+1\r\n\'-2\r\n\'@cmd\r\nfine\r\n');
  });
  it('round-trips through parseCsv', () => {
    const rows = [['a', 'b,c'], ['multi\nline', 'q"uote']];
    expect(parseCsv(toCsv(['h1', 'h2'], rows)).slice(1)).toEqual(rows);
  });
});

describe('parseCandidateCsv', () => {
  const csv = 'Name,E-mail,Mobile,Role,Company,Years,City,Skills\n' +
    'Asha Rao,asha@example.com,+91 98765 43210,Engineer,Acme,4,Pune,React; SQL\n' +
    ',nobody@example.com,,,,,,\n' +
    'Bad Email,not-an-email,,,,,,\n' +
    'Asha Again,ASHA@example.com,,,,,,\n' +
    'Ravi,,,,,abc,,\n' +
    'Meera Joshi,,,Designer,,2.5,,Figma|Research';
  it('maps common header names and keeps the good rows', () => {
    const r = parseCandidateCsv(csv);
    expect(r.error).toBeUndefined();
    expect(r.rows.map((x) => x.full_name)).toEqual(['Asha Rao', 'Meera Joshi']);
    expect(r.rows[0]).toMatchObject({ email: 'asha@example.com', phone: '+91 98765 43210', current_title: 'Engineer', years_experience: 4, location: 'Pune', skills: ['React', 'SQL'] });
    expect(r.rows[1]).toMatchObject({ email: null, years_experience: 2.5, skills: ['Figma', 'Research'] });
  });
  it('says which rows were skipped and why (row numbers count the header as row 1)', () => {
    const r = parseCandidateCsv(csv);
    expect(r.skipped).toEqual([
      { row: 3, reason: 'Name needs at least 2 characters.' },
      { row: 4, reason: 'Email is not valid.' },
      { row: 5, reason: 'Already in this job (same email).' },
      { row: 6, reason: 'Years is not a number.' },
    ]);
  });
  it('skips emails already in the job', () => {
    const r = parseCandidateCsv('name,email\nAsha Rao,asha@example.com', new Set(['asha@example.com']));
    expect(r.rows).toEqual([]);
    expect(r.skipped[0]?.reason).toMatch(/Already in this job/);
  });
  it('does not add a person without an email twice', () => {
    const r = parseCandidateCsv('name\nRavi Kumar\nravi kumar\nMeera Joshi', new Set(), new Set(['meera joshi']));
    expect(r.rows.map((x) => x.full_name)).toEqual(['Ravi Kumar']);
    expect(r.skipped.map((s) => s.reason)).toEqual(['Already in this job (same name, no email).', 'Already in this job (same name, no email).']);
  });
  it('explains file-level problems in plain words', () => {
    expect(parseCandidateCsv('').error).toMatch(/empty/);
    expect(parseCandidateCsv('email,phone\na@b.co,1').error).toMatch(/"name" column/);
    expect(parseCandidateCsv('name,email').error).toMatch(/no candidates/);
    expect(parseCandidateCsv('name\n' + Array.from({ length: 201 }, (_, i) => `Person ${i}`).join('\n')).error).toMatch(/up to 200/);
  });
});
