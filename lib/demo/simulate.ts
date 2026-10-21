import 'server-only';
import { z } from 'zod';
import { runStructured } from '@/lib/ai/client';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { markOpened, afterStart, recordSignals, resolveInvitation, saveAnswer, startAssessment } from '@/lib/portal/service';
import { afterSubmit, submitAssessment } from '@/lib/scoring/submit';
import { mapWithConcurrency } from '@/lib/scoring/safe';
import { err, ok, type Result } from '@/lib/result';
import { decryptToken } from '@/lib/security/tokens';
import { chooseOption, seededRandom, skillStrength, strengthLabel, templatedAnswer } from './strength';

const ModelAnswer = z.object({ answer: z.string() });

const SYSTEM = `You write one plausible answer that a job candidate typed into an online technical assessment, so a hiring demo looks real.

Rules:
- Write in the first person, as plain text with no markdown, no bullet characters and no headings.
- Match the stated level. "strong": a precise answer of three to five sentences that covers the key points a good engineer would. "mixed": a partly right answer of two to three sentences that misses something important. "weak": one or two vague or partly wrong sentences.
- Never mention that you are an AI, a simulation, a score or a level.
- Output must match the schema exactly.`;

type Q = { id: string; position: number; type: 'mcq' | 'short'; prompt: string; options: string[] | null; skill: string };

async function shortAnswer(q: Q, strength: number): Promise<string> {
  const res = await runStructured({
    tier: 'fast', system: SYSTEM, schema: ModelAnswer, temperature: 0.9, thinking: 'low', timeoutMs: 25_000,
    prompt: `Skill: ${q.skill}\nLevel: ${strengthLabel(strength)}\nQuestion:\n${q.prompt}`,
  });
  const text = res.ok ? res.data.output.answer.trim().slice(0, 900) : '';
  return text.length >= 10 ? text : templatedAnswer(strength, q.skill);
}

/**
 * Plays one candidate through the real start, answer and submit services, with `simulated` set so the submission and
 * every receipt carry `is_simulated`. Scoring and the report then run the normal pipeline (the route schedules it).
 * Only works in DEMO_MODE; the route checks first and this checks again.
 */
export async function simulateCandidate(invitationId: string): Promise<Result<{ candidate: string; submissionId: string }>> {
  if (!env.DEMO_MODE) return err('not_demo', 'Simulation is only available in demo mode.');
  const db = getDb();
  const row = await db.from('invitations').select('id, status, token_encrypted, assessment_id, candidates(full_name, skills)').eq('id', invitationId).maybeSingle();
  if (row.error) return err('db_error', "Couldn't load the candidate link.", row.error.message);
  if (!row.data) return err('not_found', 'Candidate link not found.');
  const inv0 = row.data as unknown as { status: string; token_encrypted: string; assessment_id: string; candidates: { full_name: string; skills: string[] } | null };
  if (!['created', 'sent', 'opened'].includes(inv0.status)) return err('not_startable', 'This candidate has already started or finished.');
  const name = inv0.candidates?.full_name ?? 'Candidate';
  const skills = inv0.candidates?.skills ?? [];

  const token = decryptToken(inv0.token_encrypted);
  const first = await resolveInvitation(token);
  if (!first.ok || !first.data) return err('not_found', 'Candidate link not found.');
  const start = first.data;
  start.simulated = true;
  await markOpened(start);
  const started = await startAssessment(start, new Date());
  if (!started.ok) return started;
  await afterStart(start);
  const again = await resolveInvitation(token);
  if (!again.ok || !again.data) return err('db_error', "Couldn't read the started assessment.");
  const inv = again.data;
  inv.simulated = true;

  const qs = await db.from('questions').select('id, position, type, prompt, options, skill').eq('assessment_id', inv.assessment_id).order('position');
  if (qs.error) return err('db_error', "Couldn't load the questions.", qs.error.message);
  const questions = qs.data as unknown as Q[];
  // Recruiter-side read of the keys: the simulator needs to know which option is right to be right with some probability.
  const keys = await db.from('question_keys').select('question_id, correct_option').in('question_id', questions.map((q) => q.id));
  if (keys.error) return err('db_error', "Couldn't load the answer keys.", keys.error.message);
  const correct = new Map((keys.data as { question_id: string; correct_option: number | null }[]).map((k) => [k.question_id, k.correct_option]));

  const rand = seededRandom(`${invitationId}:answers`);
  const strengths = new Map(questions.map((q) => [q.id, skillStrength(skills, q.skill, rand)]));
  const written = questions.filter((q) => q.type === 'short');
  const texts = await mapWithConcurrency(written, 3, (q) => shortAnswer(q, strengths.get(q.id) ?? 0.5));
  const textOf = new Map(written.map((q, i) => [q.id, texts[i] ?? '']));

  // One answer at a time, so "Question 4 of 10" moves on the War Room as it would for a person.
  for (const q of questions) {
    const answer = q.type === 'mcq'
      ? { selected_option: chooseOption(strengths.get(q.id) ?? 0.5, correct.get(q.id) ?? 0, q.options?.length ?? 4, rand), text_answer: null }
      : { selected_option: null, text_answer: textOf.get(q.id) ?? '' };
    const saved = await saveAnswer(inv, q.id, answer, q.position + 1);
    if (!saved.ok) return saved;
  }

  // A few candidates leave the tab or paste once or twice, so the integrity summary has something to show.
  const sig = seededRandom(`${invitationId}:signals`);
  const events: { type: string }[] = [];
  if (sig() < 0.4) for (let i = 0; i < 1 + Math.floor(sig() * 3); i++) events.push({ type: 'tab_hidden' });
  if (sig() < 0.25) events.push({ type: 'paste' });
  if (events.length > 0) await recordSignals(inv, events, new Date());

  const done = await submitAssessment(inv, new Date());
  if (!done.ok) return done;
  await afterSubmit(inv, { autoSubmitted: done.data.autoSubmitted, objective: done.data.objective });
  return ok({ candidate: name, submissionId: done.data.submissionId });
}
