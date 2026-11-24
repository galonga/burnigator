'use strict';
// Run with: node tests/timetable-core.test.js
const assert = require('node:assert/strict');
const {
  isRecentlyChanged,
  currentAndUpcoming,
  findClashes,
  timeMinutes,
  eventSpan,
  previousDay,
  formatTime,
  timelineItems,
  eventTimeLabel,
} = require('../assets/timetable-core.js');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('timeMinutes parses HH:MM and clamps garbage to 0', () => {
  assert.equal(timeMinutes('00:00'), 0);
  assert.equal(timeMinutes('09:30'), 570);
  assert.equal(timeMinutes('23:59'), 1439);
  assert.equal(timeMinutes('24:30'), 1439);
  assert.equal(timeMinutes('nope'), 0);
  assert.equal(timeMinutes(undefined), 0);
});

test('eventSpan: normal, default one hour, clamped at midnight', () => {
  assert.deepEqual(eventSpan({ start: '10:00', end: '12:30' }), {
    start: 600,
    end: 750,
    overnight: false,
    carryEnd: 0,
  });
  assert.deepEqual(eventSpan({ start: '10:00' }), { start: 600, end: 660, overnight: false, carryEnd: 0 });
  assert.equal(eventSpan({ start: '23:30' }).end, 1440);
  assert.equal(eventSpan({ time: '08:00' }).start, 480, 'legacy "time" field still works');
});

test('eventSpan: end earlier than start means the next day', () => {
  assert.deepEqual(eventSpan({ start: '22:00', end: '02:00' }), {
    start: 1320,
    end: 1440,
    overnight: true,
    carryEnd: 120,
  });
});

test('eventSpan: end of 00:00 simply ends at midnight', () => {
  assert.deepEqual(eventSpan({ start: '22:00', end: '00:00' }), {
    start: 1320,
    end: 1440,
    overnight: false,
    carryEnd: 0,
  });
});

test('eventSpan: equal start and end falls back to one hour', () => {
  assert.equal(eventSpan({ start: '10:00', end: '10:00' }).end, 660);
});

test('previousDay wraps from the first to the last day', () => {
  assert.equal(previousDay('tue'), 'mon');
  assert.equal(previousDay('mon'), 'sun');
  assert.equal(previousDay('thu', ['thu', 'fri', 'sat']), 'sat');
});

test('formatTime pads and round-trips', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(605), '10:05');
  assert.equal(formatTime(timeMinutes('18:45')), '18:45');
});

test('timelineItems continues an overnight event on the next day', () => {
  const late = { id: 'a', start: '22:00', end: '02:00' };
  const program = {
    fri: [late, { id: 'b', start: '10:00', end: '11:00' }],
    sat: [{ id: 'c', start: '01:00', end: '01:30' }],
  };
  const fri = timelineItems('p', program, 'fri');
  assert.deepEqual(
    fri.map((i) => i.event.id),
    ['b', 'a']
  );
  assert.equal(fri[1].overnight, true);
  const sat = timelineItems('p', program, 'sat');
  assert.deepEqual(
    sat.map((i) => [i.event.id, i.start, i.end, i.continued]),
    [
      ['a', 0, 120, true],
      ['c', 60, 90, false],
    ]
  );
});

test('timelineItems: the last day continues into the first', () => {
  const program = { sun: [{ id: 'a', start: '23:00', end: '01:00' }] };
  const mon = timelineItems('p', program, 'mon');
  assert.deepEqual(
    mon.map((i) => [i.start, i.end, i.continued]),
    [[0, 60, true]]
  );
});

test('timelineItems respects the visibility filter and does not carry non-overnight events', () => {
  const program = {
    mon: [
      { id: 'a', start: '10:00', end: '11:00' },
      { id: 'b', start: '12:00', end: '13:00' },
    ],
  };
  assert.equal(timelineItems('p', program, 'tue').length, 0);
  assert.deepEqual(
    timelineItems('p', program, 'mon', (id, d, e) => e.id === 'b').map((i) => i.event.id),
    ['b']
  );
});

test('eventTimeLabel marks continued and overnight events', () => {
  const e = { start: '22:00', end: '02:00' };
  assert.equal(eventTimeLabel(e, { overnight: true, continued: false, start: 1320 }), '22:00–02:00 →');
  assert.equal(eventTimeLabel(e, { overnight: false, continued: true, start: 0 }), '← 22:00–02:00');
  assert.equal(
    eventTimeLabel({ start: '09:00' }, { overnight: false, continued: false, start: 540 }),
    '09:00'
  );
});

test('isRecentlyChanged is true for 24 hours after the change only', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const at = (iso) => ({ changedAt: iso });
  assert.equal(isRecentlyChanged(at('2026-11-24T11:00:00Z'), now), true);
  assert.equal(isRecentlyChanged(at('2026-11-23T12:00:01Z'), now), true);
  assert.equal(isRecentlyChanged(at('2026-11-23T11:59:00Z'), now), false);
  assert.equal(
    isRecentlyChanged(at('2026-11-24T12:00:30Z'), now),
    true,
    'small clock differences are tolerated'
  );
  assert.equal(isRecentlyChanged(at('2026-11-25T12:00:00Z'), now), false, 'a far-future stamp is ignored');
  assert.equal(isRecentlyChanged({}, now), false);
  assert.equal(isRecentlyChanged(at('garbage'), now), false);
  assert.equal(isRecentlyChanged(undefined, now), false);
});

const entry = (id, start, end) => ({ id, item: { start, end } });

test('currentAndUpcoming splits running and upcoming events', () => {
  const entries = [
    entry('a', 600, 660),
    entry('b', 630, 720),
    entry('c', 700, 760),
    entry('d', 800, 900),
    entry('e', 900, 960),
    entry('f', 1000, 1060),
    entry('g', 300, 400),
  ];
  const { now, next } = currentAndUpcoming(entries, 640);
  assert.deepEqual(
    now.map((e) => e.id),
    ['a', 'b'],
    'running events, earliest end first'
  );
  assert.deepEqual(
    next.map((e) => e.id),
    ['c', 'd', 'e'],
    'next three by start time, past events excluded'
  );
  assert.equal(currentAndUpcoming(entries, 640, 1).next.length, 1);
});

test('currentAndUpcoming: boundaries and empty days', () => {
  const entries = [entry('a', 600, 660)];
  assert.equal(currentAndUpcoming(entries, 600).now.length, 1, 'an event is running from its start minute');
  assert.equal(currentAndUpcoming(entries, 660).now.length, 0, 'and no longer at its end minute');
  assert.deepEqual(currentAndUpcoming([], 100), { now: [], next: [] });
});

test('currentAndUpcoming counts an event carried over from the previous day', () => {
  const carried = { id: 'late', item: { start: 0, end: 120, continued: true } };
  assert.equal(currentAndUpcoming([carried], 30).now.length, 1);
  assert.equal(currentAndUpcoming([carried], 130).now.length, 0);
});

test('findClashes finds overlaps in both directions', () => {
  const clashes = findClashes([
    { key: 'a', start: 600, end: 700 },
    { key: 'b', start: 650, end: 750 },
    { key: 'c', start: 900, end: 960 },
  ]);
  assert.deepEqual(clashes.get('a'), ['b']);
  assert.deepEqual(clashes.get('b'), ['a']);
  assert.equal(clashes.has('c'), false);
});

test('findClashes: touching events and a single event do not clash', () => {
  assert.equal(
    findClashes([
      { key: 'a', start: 600, end: 660 },
      { key: 'b', start: 660, end: 720 },
    ]).size,
    0
  );
  assert.equal(findClashes([{ key: 'a', start: 600, end: 660 }]).size, 0);
  assert.equal(findClashes([]).size, 0);
});

test('findClashes: one event can clash with several, and an event inside another clashes', () => {
  const clashes = findClashes([
    { key: 'long', start: 600, end: 900 },
    { key: 'x', start: 620, end: 640 },
    { key: 'y', start: 700, end: 720 },
  ]);
  assert.deepEqual(clashes.get('long').sort(), ['x', 'y']);
  assert.equal(clashes.has('x') && clashes.get('x').length === 1, true);
  assert.equal(
    findClashes([
      { key: 'x', start: 1, end: 5 },
      { key: 'y', start: 6, end: 9 },
    ]).size,
    0
  );
});

test('findClashes ignores the same key twice', () => {
  assert.equal(
    findClashes([
      { key: 'a', start: 1, end: 5 },
      { key: 'a', start: 2, end: 6 },
    ]).size,
    0
  );
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (error) {
    failed++;
    console.error('FAIL ' + name + '\n' + error.message);
  }
}
if (failed) process.exit(1);
console.log(tests.length + ' timetable tests passed');
