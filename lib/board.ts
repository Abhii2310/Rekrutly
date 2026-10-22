import { canTransition, statusLabel, type Stage } from '@/lib/status';

export type BoardColumn = { key: string; label: string; stages: readonly Stage[]; /** The stage a card gets when dropped here. Null means the column is filled by Rekrutly, not by hand. */ dropStage: Stage | null; note?: string };

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  { key: 'new', label: 'New', stages: ['applied'], dropStage: null, note: 'People start here.' },
  { key: 'invited', label: 'Invited', stages: ['assessment_invited'], dropStage: null, note: 'Moves on its own when the assessment link goes out.' },
  { key: 'assessing', label: 'In assessment', stages: ['assessment_in_progress'], dropStage: null, note: 'Moves on its own when the candidate starts.' },
  { key: 'review', label: 'Review', stages: ['assessment_submitted', 'under_review'], dropStage: 'under_review' },
  { key: 'interview', label: 'Interview', stages: ['interview'], dropStage: 'interview' },
  { key: 'offer', label: 'Offer', stages: ['offer'], dropStage: 'offer' },
  { key: 'hired', label: 'Hired', stages: ['hired'], dropStage: 'hired' },
];

export const columnOf = (stage: Stage): BoardColumn | undefined => BOARD_COLUMNS.find((c) => c.stages.includes(stage));

export type DropCheck = { ok: true; to: Stage } | { ok: false; reason: string };

/** Pure. Whether a card in `from` may be dropped in `column`, and the stage it would get. */
export function checkDrop(from: Stage, column: BoardColumn): DropCheck {
  if (column.stages.includes(from)) return { ok: false, reason: 'Already there.' };
  if (!column.dropStage) return { ok: false, reason: column.note ?? 'This column fills itself.' };
  if (!canTransition('candidate', from, column.dropStage)) return { ok: false, reason: `Can't go from ${statusLabel('candidate', from)} to ${column.label} directly.` };
  return { ok: true, to: column.dropStage };
}

/** The columns a card can be moved to from where it is, for the Move menu. */
export const movableColumns = (from: Stage): BoardColumn[] => BOARD_COLUMNS.filter((c) => checkDrop(from, c).ok);
