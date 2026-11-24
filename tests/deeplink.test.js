'use strict';
// Run with: node tests/deeplink.test.js
const assert = require('node:assert/strict');
const { isValidId, parseLink, buildLink, stripLink, findEvent } = require('../assets/deeplink.js');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('isValidId accepts ids and rejects anything odd', () => {
  assert.ok(isValidId('3f9a-12_AB'));
  for (const bad of ['', 'a b', '<script>', 'x'.repeat(65), null, undefined, 5])
    assert.equal(isValidId(bad), false);
});

test('parseLink reads event and poi, event wins, junk is ignored', () => {
  assert.deepEqual(parseLink('?event=abc-1'), { type: 'event', id: 'abc-1' });
  assert.deepEqual(parseLink('?poi=p9'), { type: 'poi', id: 'p9' });
  assert.deepEqual(parseLink('?poi=p9&event=e1'), { type: 'event', id: 'e1' });
  assert.deepEqual(parseLink('?event=%3Cb%3E&poi=p9'), { type: 'poi', id: 'p9' });
  assert.equal(parseLink('?event=<b>'), null);
  assert.equal(parseLink(''), null);
  assert.equal(parseLink('?burnigatorView=map'), null);
});

test('buildLink keeps the path, drops other params and the hash', () => {
  assert.equal(
    buildLink('https://fest.example/app/index.php?burnigatorView=map&x=1#top', 'event', 'e1'),
    'https://fest.example/app/index.php?event=e1'
  );
  assert.equal(buildLink('https://fest.example/app/', 'poi', 'p1'), 'https://fest.example/app/?poi=p1');
});

test('buildLink and parseLink round-trip', () => {
  const link = buildLink('https://fest.example/', 'event', 'ab-12');
  assert.deepEqual(parseLink(new URL(link).search), { type: 'event', id: 'ab-12' });
});

test('stripLink removes only the link params', () => {
  assert.equal(
    stripLink('https://fest.example/?event=e1&burnigatorView=map#x'),
    'https://fest.example/?burnigatorView=map'
  );
  assert.equal(stripLink('https://fest.example/?poi=p1'), 'https://fest.example/');
});

test('findEvent searches places and timelines', () => {
  const data = {
    pois: [
      {
        id: 'p1',
        name: 'Stage',
        program: { fri: [{ id: 'e1', text: 'A' }], sat: [{ id: 'e2', text: 'B' }] },
      },
    ],
    timelines: [{ id: 't1', name: 'Radio', program: { sun: [{ id: 'e3', text: 'C' }] } }],
  };
  assert.deepEqual(findEvent(data, 'e2'), {
    ownerId: 'p1',
    ownerName: 'Stage',
    day: 'sat',
    event: { id: 'e2', text: 'B' },
  });
  assert.equal(findEvent(data, 'e3').ownerId, 't1');
  assert.equal(findEvent(data, 'nope'), null);
  assert.equal(findEvent({}, 'e1'), null);
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
console.log(tests.length + ' deep link tests passed');
