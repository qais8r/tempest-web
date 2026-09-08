import test from 'node:test';
import assert from 'node:assert/strict';
import { dailySelection } from '../src/lib/daily-selection.mjs';

const items = Array.from({ length: 10 }, (_, index) => ({ slug: `work-${index}` }));
const select = (date) =>
  dailySelection(items, { count: 3, seed: '2026', date, key: (item) => item.slug });

test('daily selections stay fixed within a UTC day and advance the next day', () => {
  const morning = select(new Date('2026-09-08T00:01:00Z'));
  const evening = select(new Date('2026-09-08T23:59:00Z'));
  const tomorrow = select(new Date('2026-09-09T00:01:00Z'));

  assert.deepEqual(morning, evening);
  assert.notDeepEqual(morning, tomorrow);
  assert.equal(new Set(morning.map((item) => item.slug)).size, 3);
});

test('every work receives the same exposure over a complete rotation', () => {
  const appearances = new Map(items.map((item) => [item.slug, 0]));
  for (let day = 0; day < items.length; day++) {
    const date = new Date(Date.UTC(2026, 8, 8 + day));
    for (const item of select(date)) appearances.set(item.slug, appearances.get(item.slug) + 1);
  }
  assert.deepEqual([...appearances.values()], Array(items.length).fill(3));
});
