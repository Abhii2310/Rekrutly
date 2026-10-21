export type BarItem = { label: string; value: number; display?: string; note?: string };

/**
 * Horizontal bars: label on the left, value on the right in tabular figures, 8px bars in ink on fog.
 * `max` is the value that fills the track (100 for percentages, the largest count otherwise).
 */
export function BarList({ items, max, ariaLabel }: { items: BarItem[]; max?: number; ariaLabel: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-4">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="t-body min-w-0 truncate text-ink">{i.label}</span>
            <span className="t-body tabular shrink-0 text-ink">{i.display ?? i.value}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fog" role="presentation">
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(0, Math.min(100, (i.value / top) * 100))}%` }} />
          </div>
          {i.note ? <p className="t-callout mt-1 text-ink-2">{i.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}
