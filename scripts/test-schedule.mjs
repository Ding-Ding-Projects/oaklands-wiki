#!/usr/bin/env node
/**
 * Schedule matching is pure, so every boundary can be driven without waiting for
 * a clock — which is the only practical way to test a midnight-crossing window.
 */
import assert from 'node:assert/strict';
const { matches, resolve } = await import('../src/lib/schedule.ts');

const rule = (patch = {}) => ({
  id: 'r', label: 'r', enabled: true, days: [], startTime: '20:00', endTime: '07:00',
  startDate: null, endDate: null, source: { kind: 'local' }, values: {}, ...patch,
});
const at = (iso) => new Date(iso);

// A window that crosses midnight is two intervals, not an empty one.
assert.equal(matches(rule(), at('2026-09-03T21:00')), true, '21:00 is inside 20:00-07:00');
assert.equal(matches(rule(), at('2026-09-03T02:00')), true, '02:00 is inside 20:00-07:00');
assert.equal(matches(rule(), at('2026-09-03T12:00')), false, 'midday is outside 20:00-07:00');

// Boundaries: start is inclusive, end is exclusive.
assert.equal(matches(rule({ startTime: '09:00', endTime: '17:00' }), at('2026-09-03T09:00')), true, 'start is inclusive');
assert.equal(matches(rule({ startTime: '09:00', endTime: '17:00' }), at('2026-09-03T17:00')), false, 'end is exclusive');

// Equal start and end means the whole day, not a zero-length window.
assert.equal(matches(rule({ startTime: '09:00', endTime: '09:00' }), at('2026-09-03T03:00')), true,
  'equal start and end covers the whole day');

// An empty day list means every day.
assert.equal(matches(rule({ days: [] }), at('2026-09-06T21:00')), true, 'no days selected means every day');
assert.equal(matches(rule({ days: [1] }), at('2026-09-06T21:00')), false, 'Sunday is not Monday');
assert.equal(matches(rule({ days: [0] }), at('2026-09-06T21:00')), true, '2026-09-06 is a Sunday');

// Date bounds are inclusive at both ends.
assert.equal(matches(rule({ startDate: '2026-09-03', endDate: '2026-09-03' }), at('2026-09-03T21:00')), true);
assert.equal(matches(rule({ startDate: '2026-09-04' }), at('2026-09-03T21:00')), false);
assert.equal(matches(rule({ endDate: '2026-09-02' }), at('2026-09-03T21:00')), false);

// A disabled rule never matches, whatever else lines up.
assert.equal(matches(rule({ enabled: false }), at('2026-09-03T21:00')), false);

// Invalid input is refused rather than coerced into an accidental match.
assert.equal(matches(rule({ startTime: 'nonsense' }), at('2026-09-03T21:00')), false);

// Precedence: the LAST enabled matching rule wins, and it is deterministic.
const first = rule({ id: 'a', values: { theme: 'dark' } });
const second = rule({ id: 'b', values: { theme: 'light' } });
assert.equal(resolve([first, second], at('2026-09-03T21:00')).id, 'b', 'the last matching rule wins');
assert.equal(resolve([second, first], at('2026-09-03T21:00')).id, 'a', 'order decides, and it is stable');
assert.equal(resolve([], at('2026-09-03T21:00')), null, 'no rules means no overlay');

console.log('schedule: midnight crossing, boundaries, whole-day, weekdays, date bounds, invalid input and precedence all pass');
