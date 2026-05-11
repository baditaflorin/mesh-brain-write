/**
 * Deterministic seeded shuffle. We want every phone to see the same order
 * for the released anonymous ideas, derived from a single seed (the release
 * timestamp) so there's no master/replica.
 *
 * The PRNG is mulberry32 — small, fast, decent distribution. Good enough
 * for breaking submitter-order correlation.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const ai = out[i];
    const aj = out[j];
    if (ai === undefined || aj === undefined) continue;
    out[i] = aj;
    out[j] = ai;
  }
  return out;
}
