'use strict';
// Run with: node tests/exposure-check.test.js
const assert = require('node:assert/strict');
const { PROTECTED, classify } = require('../assets/exposure-check.js');

assert.deepEqual(
  PROTECTED.map((item) => item.path),
  ['data/map.json', 'config.php', 'lib/stats.php']
);
for (const status of [301, 302, 304, 401, 403, 404, 410, 500, 0, NaN])
  for (const kind of ['json', 'php'])
    assert.equal(classify(kind, status, '{"pois":[]}<?php'), 'ok', kind + ' ' + status);
assert.equal(classify('json', 200, '{"title":"x","pois":[]}'), 'exposed');
assert.equal(classify('json', 200, '<!doctype html><title>Not found</title>'), 'ok');
assert.equal(classify('json', 200, ''), 'ok');
assert.equal(classify('json', 200, 'null'), 'ok');
assert.equal(classify('php', 200, "<?php\nreturn ['password_hash' => 'x'];"), 'exposed');
assert.equal(classify('php', 200, ''), 'ok');
assert.equal(classify('php', 200, '<html>login</html>'), 'ok');
assert.equal(classify('php', 200, undefined), 'ok');
console.log('exposure-check tests passed');
