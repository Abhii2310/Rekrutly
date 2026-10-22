import { describe, expect, it } from 'vitest';
import { parseBounce } from '@/lib/executor/bounce-parse';

describe('parseBounce', () => {
  it('reads a missing Gmail address from a delivery notice', () => {
    const src = 'Final-Recipient: rfc822; Someone@Gmail.com\nAction: failed\nStatus: 5.1.1\nDiagnostic-Code: smtp; 550 5.1.1 The email account that you tried to reach does not exist.';
    expect(parseBounce(src)).toEqual({ email: 'someone@gmail.com', notFound: true });
  });
  it('reads a Yahoo mailbox-not-found notice', () => {
    expect(parseBounce('Final-Recipient: rfc822; r@myyahoo.com\nStatus: 5.1.1\nDiagnostic-Code: smtp; 552 mailbox not found')).toEqual({ email: 'r@myyahoo.com', notFound: true });
  });
  it('falls back to the readable sentence and marks other failures as not "missing"', () => {
    expect(parseBounce("Your message wasn't delivered to a@b.com because the mailbox is full.")).toEqual({ email: 'a@b.com', notFound: false });
  });
  it('ignores mail that is not a bounce', () => {
    expect(parseBounce('Hello, just saying hi.')).toBeNull();
  });
});
