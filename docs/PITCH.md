# Rekrutly pitch and demo

## One line

**Rekrutly is the glass-box hiring agent: it plans your hiring work, shows you everything before it acts, and keeps a receipt for every step.**

## The honest market picture (know this before judges ask)

"An AI agent for hiring" is not new, and judges may know it:
- Metaview announced a $60M Series C on 30 September 2026 to bring its autonomous recruiting coworker to general availability.
- LinkedIn's agentic hiring products were reported at a $450M annualised revenue run-rate in April 2026.
- Juicebox (Sequoia-backed), Alex and others sell autonomous sourcing and screening agents. hireEZ already markets "guided autonomy" with human approval at decision points.
- A Korn Ferry survey reported that 52% of talent leaders plan to add autonomous AI agents to recruiting teams in 2026.

So never pitch "the first AI hiring agent". Pitch the sharper wedge below.

## The wedge (why Rekrutly can win)

1. **Glass box, not black box.** Most agents act and report afterwards. Rekrutly shows the plan, waits for a yes, executes only allow-listed actions, and keeps an append-only receipt for each one. Scores show their evidence; every AI judgement is labelled and overridable.
2. **The messy middle, not sourcing.** Big players fight over finding candidates. Small teams drown after that: assessments, chasing, scoring, deciding who to interview. Rekrutly owns assessment → follow-up → evidence → interview kit.
3. **Built for Indian startups (20–200 people).** WhatsApp-first follow-ups, drafts in English, Hindi and Kannada, a phone-perfect candidate experience, and guardrails that include caste as well as age, gender and religion.
4. **Privacy by design, ahead of the deadline.** India's DPDP Rules were notified on 13 November 2025 and the main obligations (notice, security safeguards, breach reporting, deletion, rights) apply from 13 May 2027. Rekrutly already has a plain-language consent notice, minimal data sent to AI, isolated answer keys, hashed and encrypted links, and receipts.

## Validation sprint (do this during the 48 hours; it's worth more than one extra feature)

Message 10 talent-acquisition managers or founders at Bengaluru startups on LinkedIn on Day 1 morning. Aim for 3 short replies or 10-minute calls. Ask only:
1. "Walk me through the last role you hired for. Where did coordination eat your time?"
2. "What happens between sending an assessment and deciding who to interview?"
3. "Would you let a tool send a nudge on your behalf, or would you want to approve each one?"

Put one real quote (with permission, first name and role only) on your closing slide. Never invent a quote or a metric.

## 5-minute demo script

Two windows: Chrome (recruiter, signed in, Overview open) and your phone (candidate). Before going on stage: Demo Director → Reset, then Simulate is ready.

**Minute 1 — The problem, then one instruction.**
Say: "A 40-person startup is hiring a full-stack developer. One person juggles assessments, chasing, scoring and scheduling across email, sheets and WhatsApp. Watch what one instruction does."
Do: Command Centre → type (or speak) the demo sentence → Enter.
Point at: the plan appears with real candidates, "1 without email", the assumptions line, and the steps waiting for you.

**Minute 2 — The agent shows its work before acting.**
Do: "Write the questions" → expand one question → edit a word → show "Edited". Point at the AI mark. Open the right column: duration, recipients, invitation preview, "What happens next".
Say: "Nothing has happened yet. Rekrutly proposes; I decide." → **Approve and create links**. The Progress Rail fills in step by step; email shows "not configured" honestly (or "sent" to your own inbox).
Optional 10 seconds: type "…only invite candidates under 30" and show the guardrail notice.

**Minute 3 — The candidate.**
Do: open Aarav's link on your phone (or the second window). Show the consent notice. Start. Answer two questions. Meanwhile point at the War Room on the laptop: "Question 2 of 10", the timer, live.
Do: Demo Director → Simulate the other candidates in the background (they're labelled Simulated).
Submit on the phone.

**Minute 4 — Evidence, not vibes.**
Do: results → Aarav → objective score (computed by code) and suggested AI score (labelled). Open a written answer: the exact quote highlighted, rubric points matched and missing. Override a score with a reason; show the receipt.
Say: "Every number here has a source. The AI suggests; the recruiter decides; Rekrutly records both."
Show interview questions aimed at his weakest skill.

**Minute 5 — The coordination layer.**
Do: War Room → "Needs you": a nudge for a candidate who hasn't started → switch the draft to Hindi or Kannada → "Open in WhatsApp" (you press send, not the AI). Scroll the receipts.
Close: "Others are building agents that act on their own. We're building the one a small team can trust: it plans, it asks, it acts only when allowed, and it keeps a receipt for everything. That's Rekrutly." Then the real recruiter quote.

## Judge Q&A

- **How is this different from LinkedIn's Hiring Assistant or Metaview?** They focus on sourcing and screening at scale for larger teams. Rekrutly is for the small team after sourcing: assessments, follow-ups and evidence, with approval gates and receipts by default.
- **Isn't approval just slowing the agent down?** Approval is one tap on a complete preview. For hiring, where decisions affect people, a visible, reversible plan is the feature. Low-risk steps (drafting, tracking) don't need approval.
- **Why trust AI scores?** Multiple-choice is scored by code. Written answers get an AI suggestion with the exact quote and rubric points, labelled as suggested, overridable with a logged reason. No automatic hiring decisions.
- **What about cheating?** Tab switches and pastes are recorded as signals, disclosed to the candidate up front, and never treated as proof. No webcam or face analysis.
- **Bias?** No protected characteristics go to the model or into filters; a guardrail removes them from instructions and logs it. Scoring is per rubric, not per person.
- **Data protection?** Minimal data to the model (no names in grading), answer keys isolated, links hashed and encrypted, RLS with no public access, consent notice, append-only audit trail; designed toward DPDP obligations that apply from May 2027.
- **Business model (hypothesis)?** Per active role per month, free for one role, aimed at teams without a full ATS. To be validated.
- **What's real today?** Everything in the demo runs on the deployed app with a real database and real AI. Simulated candidates are labelled as simulated. See the README's "real vs simulated" list.
