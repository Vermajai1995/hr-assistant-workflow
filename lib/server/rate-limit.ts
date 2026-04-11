const store = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(
  key: string,
  limit = 20,
  windowMs = 5 * 60 * 1000
) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw new Error("Rate limit exceeded. Please wait a moment and try again.");
  }

  current.count += 1;
  store.set(key, current);
}
