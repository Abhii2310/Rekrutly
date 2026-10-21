import { describe, expect, it } from 'vitest';
import { checkDraft, scriptShare } from '@/lib/ai/followup-rules';

const link = 'https://rekrutly.example/a/abc';

describe('scriptShare', () => {
  it('measures the share of letters in the language script', () => {
    expect(scriptShare('नमस्ते दिया, आपका टेस्ट तैयार है', 'hi')).toBeGreaterThan(0.9);
    expect(scriptShare('ನಮಸ್ಕಾರ ದಿಯಾ, ನಿಮ್ಮ ಪರೀಕ್ಷೆ ಸಿದ್ಧವಾಗಿದೆ', 'kn')).toBeGreaterThan(0.9);
    expect(scriptShare('Hello Diya, your test is ready', 'hi')).toBe(0);
    expect(scriptShare('', 'en')).toBe(0);
  });
});

describe('checkDraft', () => {
  it('accepts an English draft and adds the link in code', () => {
    const r = checkDraft('en', { subject: 'Your assessment', body: 'Hi Diya,\n\nYour test is ready.\n\nThe hiring team', whatsapp_text: 'Hi Diya, your test is ready.' }, link);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.body.endsWith(`Your link: ${link}`)).toBe(true);
      expect(r.draft.whatsapp_text.endsWith(`Your link: ${link}`)).toBe(true);
      expect(r.draft.language).toBe('en');
    }
  });
  it('accepts Hindi and Kannada only in their own script, with the name left in Latin letters', () => {
    const hi = checkDraft('hi', { subject: 'आपका टेस्ट', body: 'नमस्ते Diya, आपका टेस्ट तैयार है। कृपया समय मिलने पर शुरू करें।\n\nहायरिंग टीम', whatsapp_text: 'नमस्ते Diya, आपका टेस्ट तैयार है।' }, link);
    expect(hi.ok).toBe(true);
    if (hi.ok) expect(hi.draft.body).toContain(`आपका लिंक: ${link}`);
    const kn = checkDraft('kn', { subject: 'ನಿಮ್ಮ ಪರೀಕ್ಷೆ', body: 'ನಮಸ್ಕಾರ Diya, ನಿಮ್ಮ ಪರೀಕ್ಷೆ ಸಿದ್ಧವಾಗಿದೆ. ದಯವಿಟ್ಟು ಪ್ರಾರಂಭಿಸಿ.\n\nನೇಮಕಾತಿ ತಂಡ', whatsapp_text: 'ನಮಸ್ಕಾರ Diya, ನಿಮ್ಮ ಪರೀಕ್ಷೆ ಸಿದ್ಧವಾಗಿದೆ.' }, link);
    expect(kn.ok).toBe(true);
    if (kn.ok) expect(kn.draft.body).toContain('ನಿಮ್ಮ ಲಿಂಕ್');
  });
  it('rejects English text when another language was asked for', () => {
    const r = checkDraft('hi', { subject: 'Your test', body: 'Hi Diya, your test is ready. Please start soon.', whatsapp_text: 'Hi Diya, your test is ready.' }, link);
    expect(r.ok).toBe(false);
  });
  it('rejects empty messages and enforces length limits in code', () => {
    expect(checkDraft('en', { subject: 's', body: '  ', whatsapp_text: 'x' }, null).ok).toBe(false);
    const long = 'This is a sentence. '.repeat(200);
    const r = checkDraft('en', { subject: 'x'.repeat(500), body: long, whatsapp_text: long }, null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.subject.length).toBeLessThanOrEqual(121);
      expect(r.draft.body.length).toBeLessThanOrEqual(900);
      expect(r.draft.whatsapp_text.length).toBeLessThanOrEqual(420);
    }
  });
  it('leaves the link out when it can no longer be used', () => {
    const r = checkDraft('en', { subject: 's', body: 'Hello there, a note.', whatsapp_text: 'Hello.' }, null);
    expect(r.ok && r.draft.body.includes('http')).toBe(false);
  });
});
