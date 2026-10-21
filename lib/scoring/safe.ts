/**
 * Wraps background work so that it can never throw into the request that started it. If it fails, `onFail` records
 * the failure. The submission and the multiple-choice score are saved before any of this runs, so they survive.
 */
export function guardPipeline<A extends unknown[]>(
  run: (...args: A) => Promise<void>,
  onFail: (error: unknown, ...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await run(...args);
    } catch (e) {
      try {
        await onFail(e, ...args);
      } catch (inner) {
        console.error('pipeline: could not record the failure:', inner instanceof Error ? inner.message : inner);
      }
    }
  };
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping the results in order. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}
