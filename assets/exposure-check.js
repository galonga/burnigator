/*
 * Deployment self-check helpers (pure, no DOM): decide whether a protected file is served
 * to the public. The admin dashboard fetches the files from the browser (same origin, so
 * there is no server-side request and no SSRF risk) and passes status and body here.
 * The body is only inspected, never displayed or stored.
 */
(function () {
  const PROTECTED = [
    { path: 'data/map.json', kind: 'json' },
    { path: 'config.php', kind: 'php' },
    { path: 'lib/stats.php', kind: 'php' },
  ];

  // Returns 'exposed' only when the response clearly hands out the file's content.
  // 403, 404, redirects, login pages, empty bodies and executed PHP are all 'ok'.
  function classify(kind, status, body) {
    if (!Number.isInteger(status) || status < 200 || status > 299) return 'ok';
    const text = typeof body === 'string' ? body : '';
    if (kind === 'php') return text.includes('<?php') || text.includes('<?=') ? 'exposed' : 'ok';
    if (kind === 'json') {
      try {
        const data = JSON.parse(text);
        return data !== null && typeof data === 'object' ? 'exposed' : 'ok';
      } catch (_) {
        return 'ok';
      }
    }
    return 'ok';
  }

  const api = { PROTECTED, classify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.BurnigatorExposure = api;
})();
