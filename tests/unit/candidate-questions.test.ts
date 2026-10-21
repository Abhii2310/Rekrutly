import { describe, expect, it } from 'vitest';
import { CANDIDATE_QUESTION_COLUMNS } from '@/lib/db/candidate-columns';

describe('candidate question columns', () => {
  const cols = CANDIDATE_QUESTION_COLUMNS.split(',').map((c) => c.trim());
  it('selects only what a candidate may see', () => {
    expect(cols).toEqual(['id', 'position', 'type', 'prompt', 'options', 'max_score', 'skill']);
  });
  it('has no key, rubric, explanation or wildcard', () => {
    for (const banned of ['*', 'correct_option', 'rubric', 'explanation', 'model_answer', 'question_keys']) {
      expect(CANDIDATE_QUESTION_COLUMNS).not.toContain(banned);
    }
  });
});
