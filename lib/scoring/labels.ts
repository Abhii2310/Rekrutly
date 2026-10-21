/** Pure: the one-phrase state of a candidate on the results page. */
export function resultState(input: {
  invitationStatus: string;
  currentQuestion: number | null;
  questionCount: number;
  submission: { scoring_status: string; report_status: string } | null;
}): { label: string; tone: 'neutral' | 'action' | 'success' | 'warning' | 'danger' | 'ai' } {
  const { invitationStatus, currentQuestion, questionCount, submission } = input;
  if (submission) {
    if (submission.scoring_status === 'failed') return { label: 'Scoring failed', tone: 'danger' };
    if (submission.report_status === 'failed') return { label: 'Report failed', tone: 'danger' };
    if (submission.scoring_status === 'scored' && submission.report_status === 'ready') return { label: 'Ready', tone: 'success' };
    if (submission.scoring_status === 'pending' && submission.report_status === 'pending') return { label: 'Submitted', tone: 'action' };
    return { label: 'Scoring…', tone: 'ai' };
  }
  if (invitationStatus === 'started') return { label: currentQuestion ? `Question ${currentQuestion} of ${questionCount}` : 'Started', tone: 'action' };
  if (invitationStatus === 'expired') return { label: 'Expired', tone: 'warning' };
  if (invitationStatus === 'revoked') return { label: 'Revoked', tone: 'neutral' };
  return { label: 'Not started', tone: 'neutral' };
}

const times = (n: number): string => (n === 1 ? 'once' : `${n} times`);

/** Pure: "switched tabs 2 times, pasted once". Signals are hints for a person, never proof. */
export function describeSignals(s: { tab_hidden: number; paste: number; window_blur: number }): string {
  const parts: string[] = [];
  if (s.tab_hidden > 0) parts.push(`switched tabs ${times(s.tab_hidden)}`);
  if (s.window_blur > 0) parts.push(`left the window ${times(s.window_blur)}`);
  if (s.paste > 0) parts.push(`pasted ${times(s.paste)}`);
  return parts.length ? parts.join(', ') : 'no tab switches or pastes recorded';
}

const LETTERS = 'ABCDEF';
/** Pure: "Chose B. Correct answer: C." for a multiple-choice row. */
export function describeChoice(selected: number | null, correct: number | null): string {
  if (selected === null) return correct === null ? 'Not answered' : `Not answered. Correct answer: ${LETTERS[correct] ?? '?'}.`;
  const chose = `Chose ${LETTERS[selected] ?? '?'}`;
  return correct === null ? `${chose}.` : selected === correct ? `${chose}. Correct.` : `${chose}. Correct answer: ${LETTERS[correct] ?? '?'}.`;
}

/** Pure: splits an answer around the quote the grader pointed to, so the quote can be highlighted. */
export function splitAtQuote(answer: string, quote: string | null): { before: string; match: string; after: string } {
  if (!quote) return { before: answer, match: '', after: '' };
  const i = answer.indexOf(quote);
  if (i < 0) return { before: answer, match: '', after: '' };
  return { before: answer.slice(0, i), match: quote, after: answer.slice(i + quote.length) };
}
