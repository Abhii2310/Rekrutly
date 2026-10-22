import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db/server';
import { env, emailStatus, fromAddress } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { invitationHtml, invitationText, firstNameOf } from '@/lib/invitations/template';
import { err, ok, type Result } from '@/lib/result';
import { createInvitationToken, decryptToken } from '@/lib/security/tokens';
import { assertTransition, type AssessmentStatus, type Stage } from '@/lib/status';
import type { ActionName, Json } from '@/lib/db/types';
import { planDelivery } from './email-plan';
import { sendEmail } from './email';
import { analyzePipeline, draftFollowups } from './followup-actions';

export type ExecContext = { runId: string; stepId: string; jobId: string | null };

export type ActionOutcome = {
  message: string;
  result: Json;
  /** `completed` by default. `waiting` keeps the run open; `skipped` records why nothing was done. */
  status?: 'completed' | 'waiting' | 'skipped';
  /** Extra receipt data (never tokens). */
  data?: Json;
};

export interface ActionDef<P> {
  name: ActionName;
  title: (p: P) => string;
  paramsSchema: z.ZodType<P>;
  requiresApproval: boolean;
  run: (ctx: ExecContext, params: P) => Promise<Result<ActionOutcome>>;
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ids = z.array(z.uuid());

async function assessmentFor(runId: string): Promise<Result<{ id: string; title: string; status: AssessmentStatus; duration: number; proctored: boolean; aiInterview: boolean }>> {
  const a = await getDb().from('assessments').select('id, title, status, duration_minutes, proctored, ai_interview').eq('run_id', runId).maybeSingle();
  if (a.error) return err('db_error', "Couldn't load the assessment.", a.error.message);
  if (!a.data) return err('no_assessment', 'There is no assessment for this workflow yet. Write the questions first.');
  return ok({ id: a.data.id as string, title: a.data.title as string, status: a.data.status as AssessmentStatus, duration: a.data.duration_minutes as number, proctored: Boolean(a.data.proctored), aiInterview: Boolean(a.data.ai_interview) });
}

const createAssessment: ActionDef<{ title: string; durationMinutes: number }> = {
  name: 'create_assessment',
  title: () => 'Create the assessment',
  paramsSchema: z.object({ title: z.string(), durationMinutes: z.number() }),
  requiresApproval: true,
  async run(ctx) {
    const a = await assessmentFor(ctx.runId);
    if (!a.ok) return a;
    const db = getDb();
    if (a.data.status === 'draft' || a.data.status === 'approved') {
      const count = await db.from('questions').select('id', { count: 'exact', head: true }).eq('assessment_id', a.data.id);
      if ((count.count ?? 0) < 3) return err('too_few_questions', 'An assessment needs at least 3 questions.');
      // draft -> approved -> live, each checked against the status map.
      for (const to of ['approved', 'live'] as const) {
        const from = (await db.from('assessments').select('status').eq('id', a.data.id).single()).data?.status as AssessmentStatus;
        if (from === to || (from === 'live')) continue;
        const t = assertTransition('assessment', from, to);
        if (!t.ok) return t;
        const upd = await db.from('assessments').update({ status: to, ...(to === 'live' ? { published_at: new Date().toISOString() } : {}) }).eq('id', a.data.id);
        if (upd.error) return err('db_error', "Couldn't publish the assessment.", upd.error.message);
      }
    }
    return ok({ message: 'Published the assessment', result: { assessmentId: a.data.id } });
  },
};

const createInvitations: ActionDef<{ candidateIds: string[] }> = {
  name: 'create_invitations',
  title: (p) => `Create ${p.candidateIds.length} candidate ${p.candidateIds.length === 1 ? 'link' : 'links'}`,
  paramsSchema: z.object({ candidateIds: ids }),
  requiresApproval: true,
  async run(ctx, p) {
    const a = await assessmentFor(ctx.runId);
    if (!a.ok) return a;
    const db = getDb();

    const cands = await db.from('candidates').select('id, full_name, stage').in('id', p.candidateIds);
    if (cands.error) return err('db_error', "Couldn't load the candidates.", cands.error.message);
    const existing = await db.from('invitations').select('candidate_id').eq('assessment_id', a.data.id).in('candidate_id', p.candidateIds);
    if (existing.error) return err('db_error', "Couldn't check existing links.", existing.error.message);
    const have = new Set((existing.data as { candidate_id: string }[]).map((r) => r.candidate_id));
    const missing = (cands.data as { id: string; full_name: string; stage: Stage }[]).filter((c) => !have.has(c.id));

    let created: { id: string; candidate_id: string }[] = [];
    if (missing.length > 0) {
      const expires = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
      const rows = missing.map((c) => {
        const t = createInvitationToken();
        return { assessment_id: a.data.id, candidate_id: c.id, token_hash: t.hash, token_encrypted: t.encrypted, expires_at: expires };
      });
      // The unique (assessment_id, candidate_id) makes this idempotent: duplicates are ignored, not inserted.
      const ins = await db.from('invitations').upsert(rows, { onConflict: 'assessment_id,candidate_id', ignoreDuplicates: true }).select('id, candidate_id');
      if (ins.error) return err('db_error', "Couldn't create the candidate links.", ins.error.message);
      created = ins.data as { id: string; candidate_id: string }[];
    }

    const createdIds = new Set(created.map((c) => c.candidate_id));
    const toMove = missing.filter((c) => createdIds.has(c.id) && c.stage === 'applied').map((c) => c.id);
    if (toMove.length > 0) await db.from('candidates').update({ stage: 'assessment_invited' }).in('id', toMove).eq('stage', 'applied');

    for (const c of missing.filter((m) => createdIds.has(m.id))) {
      await logEvent({ runId: ctx.runId, stepId: ctx.stepId, jobId: ctx.jobId, candidateId: c.id, type: 'invitation.created', actor: 'agent', message: `Created a link for ${c.full_name}` });
    }
    const skipped = p.candidateIds.length - created.length;
    return ok({
      message: `Created ${created.length} candidate ${created.length === 1 ? 'link' : 'links'}${skipped > 0 ? `, ${skipped} already existed` : ''}`,
      result: { created: created.length, skipped },
    });
  },
};

const sendInvitations: ActionDef<{ candidateIds: string[] }> = {
  name: 'send_invitations',
  title: (p) => `Send invitations to ${p.candidateIds.length} ${p.candidateIds.length === 1 ? 'candidate' : 'candidates'} with email`,
  paramsSchema: z.object({ candidateIds: ids }),
  requiresApproval: true,
  async run(ctx) {
    const a = await assessmentFor(ctx.runId);
    if (!a.ok) return a;
    const db = getDb();
    const job = ctx.jobId ? await db.from('jobs').select('title').eq('id', ctx.jobId).maybeSingle() : null;
    const role = (job?.data?.title as string | undefined) ?? 'open';

    const rows = await db.from('invitations')
      .select('id, status, delivery_status, token_encrypted, candidates(id, full_name, email)')
      .eq('assessment_id', a.data.id);
    if (rows.error) return err('db_error', "Couldn't load the candidate links.", rows.error.message);
    type Row = { id: string; status: string; delivery_status: string; token_encrypted: string; candidates: { id: string; full_name: string; email: string | null } | null };
    // Already-sent invitations are never sent twice.
    const todo = (rows.data as unknown as Row[]).filter((r) => r.delivery_status !== 'sent');

    const plan = planDelivery(
      { status: emailStatus(env), from: fromAddress(env), demoEmail: env.DEMO_CANDIDATE_EMAIL },
      todo.map((r) => ({ id: r.id, email: r.candidates?.email ?? null })),
    );

    if (plan.unconfiguredIds.length > 0) {
      await db.from('invitations').update({ delivery_status: 'unconfigured' }).in('id', plan.unconfiguredIds);
    }
    if (plan.mode === 'skip') {
      await logEvent({ runId: ctx.runId, stepId: ctx.stepId, jobId: ctx.jobId, type: 'email.unconfigured', actor: 'agent', level: 'warning', message: plan.message });
      return ok({ message: plan.message, result: { sent: 0, failed: 0, unconfigured: plan.unconfiguredIds.length }, status: 'skipped' });
    }

    let sent = 0;
    let failed = 0;
    for (const r of todo.filter((x) => plan.sendIds.includes(x.id))) {
      const c = r.candidates;
      if (!c?.email) continue;
      const link = `${env.APP_URL}/a/${decryptToken(r.token_encrypted)}`;
      const text = invitationText({ firstName: firstNameOf(c.full_name), role, durationMinutes: a.data.duration, link, proctored: a.data.proctored, aiInterview: a.data.aiInterview });
      const res = await sendEmail({ to: c.email, subject: text.subject, text: text.body, html: invitationHtml(text.body, link), idempotencyKey: r.id });
      if (res.ok) {
        sent++;
        await db.from('invitations').update({ delivery_status: 'sent', delivery_error: null, ...(r.status === 'created' ? { status: 'sent' } : {}) }).eq('id', r.id);
        await logEvent({ runId: ctx.runId, stepId: ctx.stepId, jobId: ctx.jobId, candidateId: c.id, type: 'email.sent', actor: 'agent', level: 'success', message: `Sent the invitation to ${c.full_name}` });
      } else {
        failed++;
        await db.from('invitations').update({ delivery_status: 'failed', delivery_error: res.error.message }).eq('id', r.id);
        await logEvent({ runId: ctx.runId, stepId: ctx.stepId, jobId: ctx.jobId, candidateId: c.id, type: 'email.failed', actor: 'agent', level: 'error', message: `Couldn't email ${c.full_name}: ${res.error.message}` });
      }
    }
    const note = plan.unconfiguredIds.length > 0 ? `, ${plan.unconfiguredIds.length} to share by link` : '';
    return ok({
      message: `Sent ${sent} ${sent === 1 ? 'invitation' : 'invitations'}${failed > 0 ? `, ${failed} failed` : ''}${note}`,
      result: { sent, failed, unconfigured: plan.unconfiguredIds.length },
    });
  },
};

const trackSubmissions: ActionDef<Record<string, never>> = {
  name: 'track_submissions',
  title: () => 'Track submissions',
  paramsSchema: z.object({}).strict() as unknown as z.ZodType<Record<string, never>>,
  requiresApproval: false,
  async run(ctx) {
    const a = await assessmentFor(ctx.runId);
    if (!a.ok) return a;
    const inv = await getDb().from('invitations').select('id, status').eq('assessment_id', a.data.id);
    if (inv.error) return err('db_error', "Couldn't count the candidate links.", inv.error.message);
    const rows = inv.data as { id: string; status: string }[];
    const submitted = rows.filter((r) => r.status === 'submitted').length;
    return ok({
      message: `${submitted} of ${rows.length} candidates have submitted`,
      result: { total: rows.length, submitted },
      status: 'waiting',
    });
  },
};

export type RegisteredAction = {
  name: ActionName;
  requiresApproval: boolean;
  /** Validates the params with the action's schema, then runs it. */
  execute: (ctx: ExecContext, rawParams: unknown) => Promise<Result<ActionOutcome>>;
};

function register<P>(def: ActionDef<P>): RegisteredAction {
  return {
    name: def.name,
    requiresApproval: def.requiresApproval,
    async execute(ctx, rawParams) {
      const parsed = def.paramsSchema.safeParse(rawParams);
      if (!parsed.success) return err('invalid_params', `The settings for "${def.title(rawParams as P)}" are invalid.`);
      return def.run(ctx, parsed.data);
    },
  };
}

/** The allow-list. Nothing else may perform workflow side effects. */
export const ACTIONS: Partial<Record<ActionName, RegisteredAction>> = {
  create_assessment: register(createAssessment),
  create_invitations: register(createInvitations),
  send_invitations: register(sendInvitations),
  track_submissions: register(trackSubmissions),
  analyze_pipeline: register(analyzePipeline),
  draft_followups: register(draftFollowups),
};
