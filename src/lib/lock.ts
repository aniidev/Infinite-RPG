// Single-flight lock: dedupe concurrent identical work by key.
//
// For Milestone 1 this is an in-memory map, which only coordinates callers
// within a single serverless instance. That's enough to stop a thundering herd
// of identical cache-misses from all hitting the LLM at once on one instance.
//
// SEAM: when the app runs on more than one instance, replace this with a
// distributed lock (Redis SETNX / Redlock, or a Postgres advisory lock keyed on
// hash(recipeKey)). The signature can stay the same; only the body changes.
const inflight = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const run = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
}
