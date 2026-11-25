'use strict';
// Run with: node tests/http-integration.test.js   (needs `php` on PATH; set PHP_BIN to pick another binary)
//
// HTTP-level integration tests: copy the app into a temp directory, start `php -S` on a free port,
// run the real setup wizard, then drive api.php / admin.php like a browser would and assert on
// responses and on the resulting data/map.json. The real config.php, data/ and uploads/ are never touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { Buffer } = require('node:buffer');
const { spawn } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');

const ROOT = path.resolve(path.dirname(require.main.filename), '..');
const PHP = process.env.PHP_BIN || 'php';
const PASSWORD = 'correct horse battery staple';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let tmp;
let server;
let port;
let serverLog = '';

// ---------------------------------------------------------------- HTTP client (cookie jar, JSON helpers)

class Client {
  constructor(host) {
    this.host = host; // sent as the Host header; the login rate limit is keyed on it
    this.cookies = {};
    this.csrf = '';
  }

  raw(method, urlPath, { headers = {}, body = null } = {}) {
    const cookie = Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    const h = { Host: this.host || `127.0.0.1:${port}`, ...headers };
    if (cookie) h.Cookie = cookie;
    if (body !== null) h['Content-Length'] = Buffer.byteLength(body);
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: h }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          for (const line of res.headers['set-cookie'] || []) {
            const [pair] = line.split(';');
            const i = pair.indexOf('=');
            this.cookies[pair.slice(0, i)] = pair.slice(i + 1);
          }
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {
            /* not JSON */
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      });
      req.on('error', reject);
      if (body !== null) req.write(body);
      req.end();
    });
  }

  get(urlPath) {
    return this.raw('GET', urlPath);
  }

  form(urlPath, fields) {
    return this.raw('POST', urlPath, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
  }

  /** POST JSON to api.php?action=... with this client's CSRF token (override with opts.csrf). */
  api(action, payload, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = 'csrf' in opts ? opts.csrf : this.csrf;
    if (token !== null) headers['X-CSRF-Token'] = token;
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    return this.raw('POST', `/api.php?action=${action}${opts.query || ''}`, { headers, body });
  }

  upload(action, query, filename, content, type = 'image/png') {
    const boundary = '----burnigatortest' + Date.now();
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\n` +
        `Content-Type: ${type}\r\n\r\n`
    );
    const body = Buffer.concat([head, content, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    return this.raw('POST', `/api.php?action=${action}${query}`, {
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'X-CSRF-Token': this.csrf },
      body,
    });
  }

  async login(username, password) {
    const res = await this.form('/admin.php', { username, password });
    if (res.status === 302) {
      const page = await this.get('/admin.php');
      const m = /window\.MAP_CSRF=("[a-f0-9]+")/.exec(page.text);
      assert.ok(m, 'admin page exposes the CSRF token after login');
      this.csrf = JSON.parse(m[1]);
    }
    return res;
  }
}

// ---------------------------------------------------------------- environment

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(tmp, rel), 'utf8'));
const readMap = () => readJson('data/map.json');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port: p } = s.address();
      s.close(() => resolve(p));
    });
  });
}

function copyApp(dest) {
  const skip = new Set(['.git', '.github', '.claude', 'tests', 'node_modules', 'config.php', 'docs']);
  fs.cpSync(ROOT, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(ROOT, src);
      if (rel === '') return true;
      const top = rel.split(path.sep)[0];
      if (skip.has(top) || rel.startsWith('.reset-config-')) return false;
      // runtime state of a developer checkout must not leak into the test installation
      if ((top === 'data' || top === 'uploads') && path.basename(src) !== '.htaccess' && rel !== top)
        return false;
      return true;
    },
  });
  for (const d of ['data', 'uploads']) fs.mkdirSync(path.join(dest, d), { recursive: true });
}

async function startServer() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'burnigator-http-'));
  copyApp(tmp);
  port = await freePort();
  server = spawn(PHP, ['-S', `127.0.0.1:${port}`, '-t', tmp], {
    cwd: tmp,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  server.stderr.on('data', (d) => (serverLog += d));
  let spawnError = null;
  server.on('error', (e) => (spawnError = e));
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw new Error(`cannot start ${PHP}: ${spawnError.message}`);
    try {
      await new Client().get('/setup.php');
      return;
    } catch (e) {
      await sleep(100);
    }
  }
  throw new Error('php -S did not start:\n' + serverLog);
}

function stopServer() {
  if (server) server.kill();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------- tiny runner

const tests = [];
const test = (name, fn, opts = {}) => tests.push([name, fn, opts]);
// A test marked `knownBug` documents a defect that is reported but not fixed yet: it is expected to fail
// (shown as XFAIL). Once the defect is fixed it passes, the run fails, and the marker must be removed.

// Shared state, filled in by the tests below (they run in order and build on each other).
const S = {};
const stamp = () => readMap().updatedAt;
// updatedAt has one-second resolution; wait so that a stale token really differs from a fresh one.
const tick = () => sleep(1100);

// ---------------------------------------------------------------- tests

test('setup wizard installs the app (short password rejected, then success)', async () => {
  const c = new Client();
  assert.equal((await c.get('/admin.php')).status, 302, 'admin redirects to setup before installation');
  const short = await c.form('/setup.php', { title: 'Test Fest', password: 'short', confirm: 'short' });
  assert.equal(short.status, 200);
  assert.ok(!fs.existsSync(path.join(tmp, 'config.php')), 'no config written for a rejected password');
  const ok = await c.form('/setup.php', { title: 'Test Fest', password: PASSWORD, confirm: PASSWORD });
  assert.equal(ok.status, 302);
  assert.ok(fs.existsSync(path.join(tmp, 'config.php')));
  const map = readMap();
  assert.equal(map.title, 'Test Fest');
  assert.equal(map.published, false, 'a fresh installation is unpublished');
  assert.deepEqual(map.pois, []);
});

test('visitors get 404 for an unpublished map and API reads need no login once published', async () => {
  const anon = new Client();
  const res = await anon.get('/api.php');
  assert.equal(res.status, 404);
  assert.equal(res.json.error, 'not_published');
});

test('owner login: wrong password and unknown user are refused, correct password signs in', async () => {
  const bad = new Client();
  let res = await bad.login('owner', 'definitely wrong');
  assert.equal(res.status, 200);
  assert.match(res.text, /data-i18n="badPassword"/);
  res = await bad.login('nobody', PASSWORD);
  assert.equal(res.status, 200);
  assert.match(res.text, /data-i18n="badPassword"/);
  assert.equal(
    (await bad.api('save-poi', {}, { csrf: '' })).status,
    401,
    'still anonymous after failed logins'
  );

  S.owner = new Client();
  res = await S.owner.login('owner', PASSWORD);
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /admin\.php/);
  assert.match(S.owner.csrf, /^[a-f0-9]{64}$/);
});

test('API guards: anonymous gets 401, missing or wrong CSRF token gets 403', async () => {
  const anon = new Client();
  const unauth = await anon.api('save-poi', { poi: {} }, { csrf: null });
  assert.equal(unauth.status, 401);
  for (const action of ['save', 'save-poi', 'save-pois', 'delete-poi', 'save-program', 'set-publication']) {
    assert.equal((await anon.api(action, {}, { csrf: null })).status, 401, `${action} requires login`);
  }
  for (const action of ['stats', 'accounts', 'dashboard', 'history', 'snapshots']) {
    assert.equal((await anon.get(`/api.php?action=${action}`)).status, 403, `GET ${action} is owner only`);
  }

  const before = fs.readFileSync(path.join(tmp, 'data/map.json'), 'utf8');
  const poi = { poi: { x: 0.5, y: 0.5, name: 'Sneaky' }, expectedUpdatedAt: stamp() };
  let res = await S.owner.api('save-poi', poi, { csrf: null });
  assert.equal(res.status, 403, 'no token');
  res = await S.owner.api('save-poi', poi, { csrf: 'f'.repeat(64) });
  assert.equal(res.status, 403, 'wrong token');
  res = await S.owner.api('save-poi', poi, { csrf: '' });
  assert.equal(res.status, 403, 'empty token');
  assert.equal(fs.readFileSync(path.join(tmp, 'data/map.json'), 'utf8'), before, 'map untouched');
});

test('owner can read the unpublished map; unknown actions and bad JSON are rejected', async () => {
  let res = await S.owner.get('/api.php');
  assert.equal(res.status, 200);
  assert.equal(res.headers['x-burnigator-published'], 'false');
  assert.equal(res.json.title, 'Test Fest');
  assert.equal((await S.owner.api('no-such-action', {})).status, 404);
  assert.equal((await S.owner.api('save-poi', 'not json {')).status, 400);
});

test('save: updates settings and categories, requires a fresh expectedUpdatedAt', async () => {
  const categories = [
    { id: 'aaaa-1111', name: 'Bars', color: '#112233' },
    { id: 'bbbb-2222', name: 'Stages', color: 'not-a-colour' },
  ];
  let res = await S.owner.api('save', { title: 'Renamed', categories });
  assert.equal(res.status, 409, 'missing expectedUpdatedAt is a conflict');
  assert.equal(res.json.error, 'map_conflict');
  assert.equal(readMap().title, 'Test Fest');

  res = await S.owner.api('save', { title: '  <b>Renamed</b>  ', categories, expectedUpdatedAt: stamp() });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  const map = readMap();
  assert.ok(!/[<>]/.test(map.title), 'markup is stripped from the title');
  assert.match(map.title, /Renamed/);
  assert.deepEqual(
    map.categories.map((c) => [c.id, c.name, c.color]),
    [
      ['aaaa-1111', 'Bars', '#112233'],
      ['bbbb-2222', 'Stages', '#E94F85'],
    ],
    'invalid colour falls back to the default'
  );
  assert.equal(map.published, false, 'save never changes the publication state');
});

test('save-poi: create, update, validate position, detect stale writes', async () => {
  let res = await S.owner.api('save-poi', {
    poi: { id: 'a1', x: 0.25, y: 0.75, name: 'Main Stage', categoryId: 'bbbb-2222', icon: 'fa-music' },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  let pois = readMap().pois;
  assert.equal(pois.length, 1);
  assert.deepEqual(
    {
      id: pois[0].id,
      x: pois[0].x,
      y: pois[0].y,
      name: pois[0].name,
      cat: pois[0].categoryId,
      icon: pois[0].icon,
    },
    { id: 'a1', x: 0.25, y: 0.75, name: 'Main Stage', cat: 'bbbb-2222', icon: 'fa-music' }
  );

  // Omitted fields keep their old values; unknown category and bad icon are normalised.
  res = await S.owner.api('save-poi', {
    poi: { id: 'a1', name: 'Main Stage 2', categoryId: 'does-not-exist', icon: '<b>x</b>' },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  pois = readMap().pois;
  assert.equal(pois.length, 1, 'same id updates in place');
  assert.equal(pois[0].x, 0.25);
  assert.equal(pois[0].name, 'Main Stage 2');
  assert.equal(pois[0].categoryId, '');
  assert.ok(!/[<>]/.test(pois[0].icon), 'icon markup is stripped');

  for (const [x, y] of [
    [1.5, 0.5],
    [-0.1, 0.5],
    [0.5, 2],
  ]) {
    res = await S.owner.api('save-poi', { poi: { x, y, name: 'Off map' }, expectedUpdatedAt: stamp() });
    assert.equal(res.status, 400, `position ${x},${y} is rejected`);
  }
  assert.equal(readMap().pois.length, 1);

  await tick();
  S.stale = stamp();
  res = await S.owner.api('save-poi', {
    poi: { id: 'a2', x: 0.5, y: 0.5, name: 'Bar' },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  assert.notEqual(stamp(), S.stale, 'a save moves updatedAt');
  res = await S.owner.api('save-poi', {
    poi: { id: 'a3', x: 0.1, y: 0.1, name: 'Late' },
    expectedUpdatedAt: S.stale,
  });
  assert.equal(res.status, 409, 'stale token is a conflict');
  assert.equal(res.json.error, 'map_conflict');
  assert.deepEqual(
    readMap().pois.map((p) => p.id),
    ['a1', 'a2']
  );
});

test('save-pois: bulk update moves existing places and keeps their programs', async () => {
  let res = await S.owner.api('save-program', {
    program: {
      id: 'a1',
      hasProgram: true,
      program: { fri: [{ id: 'e1', start: '20:00', end: '21:30', text: 'Opening' }] },
    },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);

  res = await S.owner.api('save-pois', {
    pois: [
      { id: 'a1', x: 0.9, y: 0.9, name: 'Main Stage' },
      { id: 'a2', x: 0.4, y: 0.4 },
      { id: 'not valid id!', x: 0.1, y: 0.1, name: 'ignored' },
    ],
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  let byId = Object.fromEntries(readMap().pois.map((p) => [p.id, p]));
  assert.deepEqual([byId.a1.x, byId.a1.y], [0.9, 0.9]);
  assert.deepEqual([byId.a2.x, byId.a2.y], [0.4, 0.4]);
  assert.equal(byId.a2.name, 'Bar', 'omitted name is kept');
  assert.equal(byId.a1.program.fri.length, 1, 'bulk update does not touch programs');
  assert.equal(Object.keys(byId).length, 2, 'invalid ids are skipped');

  assert.equal((await S.owner.api('save-pois', { pois: 'nope', expectedUpdatedAt: stamp() })).status, 400);
  res = await S.owner.api('save-pois', { pois: [{ id: 'a1', x: 7, y: 0.1 }], expectedUpdatedAt: stamp() });
  assert.equal(res.status, 400, 'out of range position rejects the whole batch');
  assert.equal(readMap().pois.find((p) => p.id === 'a1').x, 0.9);
  res = await S.owner.api('save-pois', { pois: [], expectedUpdatedAt: '1999-01-01T00:00:00+00:00' });
  assert.equal(res.status, 409);
});

test('save-program: stores events, rejects zero-length times, unknown places and stale writes', async () => {
  let res = await S.owner.api('save-program', {
    program: {
      id: 'a2',
      hasProgram: true,
      program: {
        sat: [
          { id: 'e2', start: '22:00', text: 'Fire show' },
          { start: '25:99', text: 'dropped: bad time' },
          { start: '10:00', text: '' },
        ],
      },
    },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  const a2 = readMap().pois.find((p) => p.id === 'a2');
  assert.equal(a2.hasProgram, true);
  assert.deepEqual(
    a2.program.sat.map((e) => [e.id, e.start, e.text]),
    [['e2', '22:00', 'Fire show']],
    'invalid and empty events are dropped'
  );

  res = await S.owner.api('save-program', {
    program: { id: 'a2', program: { sat: [{ start: '10:00', end: '10:00', text: 'x' }] } },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'invalid_event_time');

  res = await S.owner.api('save-program', {
    program: { id: 'ghost', program: {} },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 404);
  res = await S.owner.api('save-program', { program: { id: 'a2', program: {} }, expectedUpdatedAt: S.stale });
  assert.equal(res.status, 409);
  assert.equal(readMap().pois.find((p) => p.id === 'a2').program.sat.length, 1, 'nothing changed');
});

test('save-accounts creates poi and www logins; role limits are enforced', async () => {
  let res = await S.owner.api('save-accounts', {
    accounts: {
      poi: { username: 'poi.user', password: 'poi password 12345', passwordConfirm: 'poi password 12345' },
      www: { username: 'www.user', password: 'short', passwordConfirm: 'short' },
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'password_too_short');
  res = await S.owner.api('save-accounts', {
    accounts: {
      poi: { username: 'poi.user', password: 'poi password 12345', passwordConfirm: 'poi password 12345' },
      www: { username: 'www.user', password: 'www password 12345', passwordConfirm: 'mismatch mismatch' },
    },
  });
  assert.equal(res.json.error, 'password_mismatch');
  res = await S.owner.api('save-accounts', {
    accounts: {
      poi: { username: 'poi.user', password: 'poi password 12345', passwordConfirm: 'poi password 12345' },
      www: { username: 'www.user', password: 'www password 12345', passwordConfirm: 'www password 12345' },
    },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.accounts, { poi: { username: 'poi.user' }, www: { username: 'www.user' } });
  const stored = readJson('data/accounts.json');
  assert.ok(stored['poi.user'].password_hash.startsWith('$'), 'passwords are stored hashed');
  assert.ok(!JSON.stringify(stored).includes('poi password'), 'no plaintext password on disk');

  S.poi = new Client();
  S.www = new Client();
  assert.equal((await S.poi.login('poi.user', 'poi password 12345')).status, 302);
  assert.equal((await S.www.login('www.user', 'www password 12345')).status, 302);
});

test('role guards: poi, www and owner only reach their own actions', async () => {
  const forbidden = async (client, action, payload = {}) => {
    const res = await client.api(action, { expectedUpdatedAt: stamp(), ...payload });
    assert.equal(res.status, 403, `${action} must be forbidden`);
  };
  for (const action of ['save', 'save-accounts', 'set-publication']) await forbidden(S.poi, action);
  await forbidden(S.poi, 'save-program', { program: { id: 'a1', program: {} } });
  await forbidden(S.poi, 'save-timelines', { timelines: [] });
  for (const action of ['save', 'save-accounts', 'set-publication', 'save-poi', 'save-pois', 'delete-poi']) {
    await forbidden(S.www, action);
  }
  for (const [client, name] of [
    [S.poi, 'poi'],
    [S.www, 'www'],
  ]) {
    await forbidden(client, 'restore-snapshot', { id: '20240101-000000-abcdef12' });
    await forbidden(client, 'restore-backup', { map: {}, assets: {} });
    await forbidden(client, 'change-owner-password', {});
    assert.equal((await client.upload('upload', '', 'x.png', PNG)).status, 403, `${name} cannot upload`);
    assert.equal((await client.upload('upload-branding', '&kind=logo', 'x.png', PNG)).status, 403);
    for (const a of ['stats', 'accounts', 'dashboard', 'history', 'snapshots']) {
      assert.equal((await client.get(`/api.php?action=${a}`)).status, 403, `${name} cannot read ${a}`);
    }
  }
  // They are allowed to preview the unpublished map.
  assert.equal((await S.poi.get('/api.php')).status, 200);
  assert.equal((await S.www.get('/api.php')).status, 200);
});

test('poi role edits places but cannot change programs or delete places with events', async () => {
  let res = await S.poi.api('save-poi', {
    poi: {
      id: 'a1',
      name: 'Renamed by poi',
      program: { mon: [{ start: '09:00', text: 'smuggled' }] },
      hasProgram: false,
    },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  const a1 = readMap().pois.find((p) => p.id === 'a1');
  assert.equal(a1.name, 'Renamed by poi');
  assert.equal(a1.hasProgram, true, 'poi cannot switch the program off');
  assert.deepEqual(a1.program.mon, [], 'poi cannot add events');
  assert.equal(a1.program.fri.length, 1, 'existing events are kept');

  res = await S.poi.api('delete-poi', { id: 'a1', expectedUpdatedAt: stamp() });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'poi_has_events');
  assert.ok(readMap().pois.some((p) => p.id === 'a1'));

  res = await S.poi.api('save-pois', { pois: [{ id: 'a2', x: 0.55, y: 0.55 }], expectedUpdatedAt: stamp() });
  assert.equal(res.status, 200);
});

test('www role edits programs and timelines', async () => {
  let res = await S.www.api('save-program', {
    program: {
      id: 'a2',
      hasProgram: true,
      program: { sun: [{ id: 'e3', start: '12:00', end: '13:00', text: 'Brunch' }] },
    },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  assert.equal(readMap().pois.find((p) => p.id === 'a2').program.sun[0].text, 'Brunch');

  res = await S.www.api('save-timelines', {
    timelines: [{ name: '', program: {} }],
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'timeline_name_required');
  res = await S.www.api('save-timelines', {
    timelines: [{ name: 'Radio', program: { sat: [{ id: 'r1', start: '08:00', text: 'Morning show' }] } }],
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  const tl = readMap().timelines;
  assert.equal(tl.length, 1);
  assert.equal(tl[0].name, 'Radio');
  res = await S.www.api('save-timelines', {
    timelines: Array.from({ length: 4 }, (_, i) => ({ name: `T${i}`, program: {} })),
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 400, 'at most three timelines');
});

test('delete-poi: owner deletes, unknown ids and stale writes are refused', async () => {
  await S.owner.api('save-poi', {
    poi: { id: 'd1', x: 0.3, y: 0.3, name: 'Temp' },
    expectedUpdatedAt: stamp(),
  });
  assert.ok(readMap().pois.some((p) => p.id === 'd1'));

  let res = await S.owner.api('delete-poi', { id: 'd1', expectedUpdatedAt: S.stale });
  assert.equal(res.status, 409);
  res = await S.owner.api('delete-poi', { id: 'unknown', expectedUpdatedAt: stamp() });
  assert.equal(res.status, 404);
  res = await S.owner.api('delete-poi', { id: 'd1', expectedUpdatedAt: stamp() });
  assert.equal(res.status, 200);
  assert.ok(!readMap().pois.some((p) => p.id === 'd1'));

  // A poi-role user may delete a place that has no events.
  await S.owner.api('save-poi', {
    poi: { id: 'd2', x: 0.3, y: 0.3, name: 'Temp 2' },
    expectedUpdatedAt: stamp(),
  });
  res = await S.poi.api('delete-poi', { id: 'd2', expectedUpdatedAt: stamp() });
  assert.equal(res.status, 200);
  assert.ok(!readMap().pois.some((p) => p.id === 'd2'));
});

test('snapshots: every save keeps a snapshot, at most five, listed for the owner', async () => {
  const snapDir = path.join(tmp, 'data/snapshots');
  const files = fs.readdirSync(snapDir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'saves created snapshots');
  assert.ok(files.length <= 5, 'only the five newest snapshots are kept');
  for (const f of files) assert.match(f, /^\d{8}-\d{6}-[a-f0-9]{8}\.json$/);

  const res = await S.owner.get('/api.php?action=snapshots');
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.json.snapshots.map((s) => s.id).sort(),
    files.map((f) => f.replace('.json', '')).sort()
  );
  for (const s of res.json.snapshots)
    assert.equal(s.pois, readJson(`data/snapshots/${s.id}.json`).pois.length);

  const hist = await S.owner.get('/api.php?action=history');
  assert.equal(hist.status, 200);
  assert.ok(hist.json.history.length > 0, 'actions are recorded in the history');
});

test('restore-snapshot: validation, conflict, and restoring an earlier state', async () => {
  const id = (await S.owner.get('/api.php?action=snapshots')).json.snapshots[0].id;
  let res = await S.owner.api('restore-snapshot', { id: '../../config', expectedUpdatedAt: stamp() });
  assert.equal(res.status, 400, 'path traversal is not a snapshot id');
  res = await S.owner.api('restore-snapshot', { id: '20200101-000000-deadbeef', expectedUpdatedAt: stamp() });
  assert.equal(res.status, 404);
  res = await S.owner.api('restore-snapshot', { id });
  assert.equal(res.status, 409, 'restore needs expectedUpdatedAt');
  res = await S.owner.api('restore-snapshot', { id, expectedUpdatedAt: '1999-01-01T00:00:00+00:00' });
  assert.equal(res.status, 409);

  // Make a visible change, then go back to the snapshot taken just before it.
  await S.owner.api('save-poi', {
    poi: { id: 'c1', x: 0.6, y: 0.6, name: 'Added later' },
    expectedUpdatedAt: stamp(),
  });
  const withExtra = readMap().pois.map((p) => p.id);
  assert.ok(withExtra.includes('c1'));
  const target = (await S.owner.get('/api.php?action=snapshots')).json.snapshots
    .map((s) => ({ ...s, content: readJson(`data/snapshots/${s.id}.json`) }))
    .find((s) => !s.content.pois.some((p) => p.id === 'c1'));
  assert.ok(target, 'a snapshot from before the change exists');

  // The map is unpublished: restore must keep that state even if the snapshot says otherwise.
  const before = stamp();
  res = await S.owner.api('restore-snapshot', { id: target.id, expectedUpdatedAt: before });
  assert.equal(res.status, 200);
  const after = readMap();
  assert.deepEqual(
    after.pois.map((p) => p.id),
    target.content.pois.map((p) => p.id)
  );
  assert.ok(!after.pois.some((p) => p.id === 'c1'));
  assert.equal(after.published, false);
  assert.deepEqual(
    res.json.map.pois.map((p) => p.id),
    after.pois.map((p) => p.id)
  );
  const hist = (await S.owner.get('/api.php?action=history')).json.history;
  assert.ok(
    hist.some((h) => h.action === 'snapshot_restore'),
    'restore is recorded in the history'
  );
});

test('restore-backup: validation and a full restore', async () => {
  const backup = (overrides = {}) => ({
    map: {
      title: 'Restored Fest',
      categories: [{ id: 'cafe-1', name: 'Food', color: '#00FF00' }],
      pois: [
        {
          id: 'b1',
          x: 0.1,
          y: 0.2,
          name: 'Noodles',
          categoryId: 'cafe-1',
          icon: 'fa-utensils',
          hasProgram: true,
          program: { thu: [{ id: 'be1', start: '18:00', text: 'Cooking' }] },
        },
        { id: 'b2', x: 0.8, y: 0.9, name: 'Chai', categoryId: 'unknown' },
      ],
      timelines: [],
      customButton: { label: 'Tickets', url: 'https://example.org/tickets' },
      qrUrl: 'javascript:alert(1)',
    },
    assets: { image: '', logo: '', favicon: '' },
    expectedUpdatedAt: stamp(),
    ...overrides,
  });

  let res = await S.owner.api('restore-backup', { map: {} });
  assert.equal(res.status, 400, 'assets are required');
  res = await S.owner.api(
    'restore-backup',
    backup({ assets: { logo: 'uploads/logo-aaaaaaaaaaaaaaaaaaaaaaaa.png' } })
  );
  assert.equal(res.status, 400, 'referenced asset must exist');
  res = await S.owner.api('restore-backup', backup({ assets: { logo: '../config.php' } }));
  assert.equal(res.status, 400, 'asset paths are whitelisted');
  const bad = backup();
  bad.map.pois.push({ id: 'b3', x: 5, y: 0, name: 'Off map' });
  assert.equal((await S.owner.api('restore-backup', bad)).status, 400);
  const badTime = backup();
  badTime.map.timelines = [{ name: 'T', program: { fri: [{ start: '10:00', end: '10:00', text: 'x' }] } }];
  assert.equal((await S.owner.api('restore-backup', badTime)).json.error, 'invalid_event_time');
  res = await S.owner.api('restore-backup', backup({ expectedUpdatedAt: '1999-01-01T00:00:00+00:00' }));
  assert.equal(res.status, 409);
  assert.notEqual(readMap().title, 'Restored Fest', 'rejected restores change nothing');

  res = await S.owner.api('restore-backup', backup());
  assert.equal(res.status, 200);
  const map = readMap();
  assert.equal(map.title, 'Restored Fest');
  assert.deepEqual(
    map.pois.map((p) => p.id),
    ['b1', 'b2']
  );
  assert.equal(map.pois[0].categoryId, 'cafe-1');
  assert.equal(map.pois[1].categoryId, '', 'unknown category is cleared');
  assert.equal(map.pois[0].program.thu[0].text, 'Cooking');
  assert.deepEqual(map.customButton, { label: 'Tickets', url: 'https://example.org/tickets' });
  assert.equal(map.qrUrl, '', 'non-http URLs are dropped');
  assert.equal(map.published, false, 'restore keeps the current publication state');
});

test('set-publication: needs a boolean and a fresh token, controls visitor access', async () => {
  const anon = new Client();
  let res = await S.owner.api('set-publication', { published: 'yes', expectedUpdatedAt: stamp() });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'invalid_publication_state');
  res = await S.owner.api('set-publication', { published: true });
  assert.equal(res.status, 409);
  res = await S.owner.api('set-publication', {
    published: true,
    expectedUpdatedAt: '1999-01-01T00:00:00+00:00',
  });
  assert.equal(res.status, 409);
  assert.equal(readMap().published, false);

  res = await S.owner.api('set-publication', { published: true, expectedUpdatedAt: stamp() });
  assert.equal(res.status, 200);
  assert.equal(readMap().published, true);
  res = await anon.get('/api.php');
  assert.equal(res.status, 200);
  assert.equal(res.headers['x-burnigator-published'], 'true');
  assert.equal(res.json.title, 'Restored Fest');
  assert.equal(res.json.pois.length, 2);

  res = await S.owner.api('set-publication', { published: false, expectedUpdatedAt: stamp() });
  assert.equal(res.status, 200);
  assert.equal(readMap().published, false);
  res = await anon.get('/api.php');
  assert.equal(res.status, 404);
  assert.equal(res.json.error, 'not_published');
});

test('upload: only real PNG or JPG images are accepted and attached to the map', async () => {
  let res = await S.owner.raw('POST', '/api.php?action=upload', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': S.owner.csrf },
    body: '{}',
  });
  assert.equal(res.status, 400, 'no file');
  res = await S.owner.upload('upload', '', 'evil.png', Buffer.from('<?php echo 1; ?>'));
  assert.equal(res.status, 400, 'text pretending to be a PNG');
  res = await S.owner.upload(
    'upload',
    '',
    'anim.gif',
    Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'),
    'image/gif'
  );
  assert.equal(res.status, 400, 'GIF is not allowed');
  assert.deepEqual(
    fs.readdirSync(path.join(tmp, 'uploads')).filter((f) => f !== '.htaccess'),
    []
  );

  res = await S.owner.upload('upload', '', 'map.png', PNG);
  assert.equal(res.status, 200);
  const image = res.json.map.image;
  assert.match(image, /^uploads\/map-[a-f0-9]{24}\.png$/);
  assert.ok(fs.existsSync(path.join(tmp, image)));
  assert.deepEqual([readMap().image, readMap().width, readMap().height], [image, 1, 1]);
  assert.equal((await new Client().get('/' + image)).status, 200, 'uploaded image is served');

  res = await S.owner.upload('upload-branding', '&kind=banner', 'x.png', PNG);
  assert.equal(res.status, 400, 'unknown branding kind');
  res = await S.owner.upload('upload-branding', '&kind=logo', 'logo.png', PNG);
  assert.equal(res.status, 200);
  assert.match(readMap().logo, /^uploads\/logo-[a-f0-9]{24}\.png$/);
  assert.equal(readMap().image, image, 'branding upload keeps the map image');

  // A backup that references the uploaded files restores them.
  res = await S.owner.api('restore-backup', {
    map: { title: 'With image', categories: [], pois: [], timelines: [] },
    assets: { image, logo: readMap().logo, favicon: '' },
    expectedUpdatedAt: stamp(),
  });
  assert.equal(res.status, 200);
  assert.deepEqual([readMap().image, readMap().width, readMap().height], [image, 1, 1]);
});

test('owner password change: needs the current password, 12+ characters and a matching confirmation', async () => {
  const next = 'a brand new long password';
  let res = await S.owner.api('change-owner-password', {
    currentPassword: 'wrong',
    password: next,
    passwordConfirm: next,
  });
  assert.equal(res.json.error, 'current_password_invalid');
  res = await S.owner.api('change-owner-password', {
    currentPassword: PASSWORD,
    password: 'short',
    passwordConfirm: 'short',
  });
  assert.equal(res.json.error, 'password_too_short');
  res = await S.owner.api('change-owner-password', {
    currentPassword: PASSWORD,
    password: next,
    passwordConfirm: next + 'x',
  });
  assert.equal(res.json.error, 'password_mismatch');
  res = await S.owner.api('change-owner-password', {
    currentPassword: PASSWORD,
    password: next,
    passwordConfirm: next,
  });
  assert.equal(res.status, 200);
  assert.match(res.json.csrf, /^[a-f0-9]{64}$/);
  assert.notEqual(res.json.csrf, S.owner.csrf, 'the CSRF token rotates');
  assert.equal((await S.owner.api('save-poi', {}, { csrf: S.owner.csrf })).status, 403, 'old token is dead');
  S.owner.csrf = res.json.csrf;
  assert.equal(
    (await S.owner.api('save-poi', { poi: {}, expectedUpdatedAt: '' })).status,
    409,
    'new token passes the CSRF check'
  );

  const fresh = new Client();
  assert.equal((await fresh.login('owner', PASSWORD)).status, 200, 'old password no longer works');
  assert.equal((await fresh.login('owner', next)).status, 302, 'new password works');
  S.owner2 = fresh;
});

test('logout ends the session', async () => {
  const res = await S.owner2.get('/admin.php?logout=1');
  assert.equal(res.status, 302);
  const after = await S.owner2.api('save-poi', {}, { csrf: S.owner2.csrf });
  assert.equal(after.status, 401);
});

test(
  'login rate limit: five failures lock the client out, even for the right password',
  async () => {
    // The limiter keys on client address plus Host header, so a separate Host keeps this isolated.
    const victim = new Client(`ratelimit.test:${port}`);
    const next = 'a brand new long password';
    for (let i = 1; i <= 4; i++) {
      const res = await victim.login('owner', `wrong ${i}`);
      assert.match(res.text, /data-i18n="badPassword"/, `attempt ${i} is a normal failure`);
    }
    const fifth = await victim.login('owner', 'wrong 5');
    assert.match(fifth.text, /data-i18n="loginRateLimited"/, 'the fifth failure locks the account');
    const locked = await victim.login('owner', next);
    assert.equal(locked.status, 200, 'the correct password is refused while locked');
    assert.match(locked.text, /data-i18n="loginRateLimited"/);
    assert.equal((await victim.api('save-poi', {}, { csrf: '' })).status, 401);
    const attempts = readJson('data/login-attempts.json');
    assert.ok(Object.values(attempts).some((a) => a.count >= 5 && a.until > Date.now() / 1000));

    // Other clients are unaffected.
    const other = new Client();
    assert.equal((await other.login('owner', next)).status, 302);
  },
  {
    knownBug:
      'beginLoginAttempt() in auth.php resets the failure count on every attempt, so the lockout never engages',
  }
);

// ---------------------------------------------------------------- main

async function main() {
  await startServer();
  let failed = 0;
  try {
    for (const [name, fn, opts] of tests) {
      try {
        await fn();
        if (opts.knownBug) {
          failed++;
          console.log(
            `FAIL ${name}\n     passes now: the known bug (${opts.knownBug}) is fixed, remove the knownBug marker`
          );
          continue;
        }
        console.log(`ok   ${name}`);
      } catch (e) {
        if (opts.knownBug) {
          console.log(
            `XFAIL ${name}\n     known bug: ${opts.knownBug}\n     ${String(e.message).split('\n')[0]}`
          );
          continue;
        }
        failed++;
        console.log(`FAIL ${name}\n${String(e && e.stack ? e.stack : e).replace(/^/gm, '     ')}`);
      }
    }
    const phpProblems = serverLog
      .split('\n')
      .filter((l) => /PHP (Warning|Notice|Deprecated|Fatal|Parse)/.test(l));
    if (phpProblems.length) {
      failed++;
      console.log(`FAIL PHP reported problems while serving requests:\n${phpProblems.join('\n')}`);
    }
  } finally {
    stopServer();
  }
  console.log(failed ? `\n${failed} failing` : `\nall ${tests.length} HTTP integration tests passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  stopServer();
  process.exit(1);
});
