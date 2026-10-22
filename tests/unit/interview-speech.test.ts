import { describe, expect, it } from 'vitest';
import { bestVoiceIndex, cleanQuestion, rankVoice, spokenText, splitSentences } from '@/lib/ai-interview/speech';

describe('clean text', () => {
  it('turns non-breaking hyphens, curly quotes and long dashes into plain ones', () => {
    expect(cleanQuestion('Tell me about an end‑to‑end flow you’ve built — and why.')).toBe("Tell me about an end-to-end flow you've built, and why.");
    expect(cleanQuestion('a  b   c')).toBe('a b c');
  });
  it('splits into sentences', () => {
    expect(splitSentences('First one. Second one? Third!')).toEqual(['First one.', 'Second one?', 'Third!']);
  });
});

describe('spoken text', () => {
  it('spells out short forms and reads hyphenated words as two', () => {
    expect(spokenText('Describe a B2B end-to-end UX flow, e.g. for an API & SQL tool')).toBe('Describe a B to B end to end U X flow, for example for an A P I and sequel tool');
    expect(spokenText('user‑research or design/engineering')).toBe('user research or design or engineering');
  });
});

describe('voice choice', () => {
  it('prefers natural, warm English voices and avoids robotic ones', () => {
    const voices = [
      { name: 'Fred', lang: 'en-US' },
      { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' },
      { name: 'Google UK English Female', lang: 'en-GB' },
      { name: 'eSpeak English', lang: 'en' },
      { name: 'Hindi', lang: 'hi-IN' },
    ];
    expect(voices[bestVoiceIndex(voices)]?.name).toContain('Aria');
    expect(rankVoice('Hindi', 'hi-IN')).toBe(99);
    expect(rankVoice('Google UK English Female', 'en-GB')).toBeLessThan(rankVoice('Fred', 'en-US'));
  });
  it('returns -1 when there is no English voice', () => {
    expect(bestVoiceIndex([{ name: 'Hindi', lang: 'hi-IN' }])).toBe(-1);
  });
});
