const DAY_MS = 24 * 60 * 60 * 1000;

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function utcDay(date) {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS,
  );
}

/**
 * Choose a stable daily window from a shuffled catalog. Advancing by the window
 * size gives every item the same number of appearances over a complete cycle.
 *
 * @template T
 * @param {T[]} items
 * @param {{ count?: number, seed?: string, date?: Date, key?: (item: T) => string }} [options]
 * @returns {T[]}
 */
export function dailySelection(
  items,
  { count = 3, seed = '', date = new Date(), key = (item) => String(item) } = {},
) {
  const size = Math.min(Math.max(0, Math.floor(count)), items.length);
  if (!size) return [];

  const ordered = items
    .map((item, index) => {
      const identity = key(item);
      return { item, identity, index, rank: hash(`${seed}:${identity}`) };
    })
    .sort(
      (a, b) => a.rank - b.rank || a.identity.localeCompare(b.identity, 'en') || a.index - b.index,
    );
  const offset = (utcDay(date) * size) % ordered.length;
  return Array.from(
    { length: size },
    (_, index) => ordered[(offset + index) % ordered.length].item,
  );
}
