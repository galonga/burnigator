(function () {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.ADMIN_ROLE !== 'owner') return;
    const $ = (id) => document.getElementById(id);
    const toggle = $('stats-enabled');
    if (!toggle) return;
    const t = (key) => window.AppI18n.t(key);
    const note = (text) => ($('stats-status').textContent = text);

    async function post(action, body) {
      const response = await fetch('api.php?action=' + action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': window.MAP_CSRF },
        body: JSON.stringify(body || {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'failed');
      return result;
    }

    function cell(tag, text, className) {
      const node = document.createElement(tag);
      node.textContent = text;
      if (className) node.className = className;
      return node;
    }

    function table(host, columns, rows) {
      host.replaceChildren();
      if (!rows.length) {
        host.append(cell('p', t('statsNoData'), 'hint'));
        return;
      }
      const el = document.createElement('table');
      el.className = 'stats-table';
      const head = el.createTHead().insertRow();
      columns.forEach((c) => head.append(cell('th', t(c.label), c.num ? 'num' : '')));
      const body = el.createTBody();
      rows.forEach((row) => {
        const tr = body.insertRow();
        columns.forEach((c) => tr.append(cell('td', String(row[c.key] ?? ''), c.num ? 'num' : '')));
      });
      host.append(el);
    }

    function render(data) {
      $('stats-report').hidden = false;
      const totals = $('stats-totals');
      totals.replaceChildren();
      [
        ['statsVisits', data.totals.visits],
        ['statsEventOpens', data.totals.eventOpens],
        ['statsPoiOpens', data.totals.poiOpens],
        ['statsFavorites', data.totals.favorites],
      ].forEach(([label, value]) => {
        const box = document.createElement('div');
        box.className = 'stats-total';
        box.append(cell('strong', String(value)), cell('span', t(label)));
        totals.append(box);
      });
      const bars = $('stats-bars');
      bars.replaceChildren();
      const max = Math.max(1, ...data.perDay.map((d) => d.visits));
      data.perDay.forEach((d) => {
        const bar = document.createElement('span');
        bar.className = 'stats-bar';
        bar.style.height = Math.max(2, (d.visits / max) * 100) + '%';
        bar.title = d.day + ': ' + d.visits;
        bars.append(bar);
      });
      bars.setAttribute(
        'aria-label',
        t('statsVisitsPerDay') + ': ' + data.perDay.map((d) => d.day + ' ' + d.visits).join(', ')
      );
      table(
        $('stats-events'),
        [
          { key: 'name', label: 'statsColEvent' },
          { key: 'place', label: 'statsColPlace' },
          { key: 'opens', label: 'statsColOpens', num: true },
          { key: 'favorites', label: 'statsColFavorites', num: true },
        ],
        data.topEvents
      );
      table(
        $('stats-pois'),
        [
          { key: 'name', label: 'statsColPlace' },
          { key: 'opens', label: 'statsColOpens', num: true },
        ],
        data.topPois
      );
    }

    async function load() {
      try {
        const response = await fetch(
          'api.php?action=stats&days=' + encodeURIComponent($('stats-range').value),
          {
            credentials: 'same-origin',
            cache: 'no-store',
          }
        );
        if (!response.ok) throw new Error('http');
        const data = await response.json();
        toggle.checked = data.enabled === true;
        note(t(data.enabled ? 'statsEnabledNote' : 'statsDisabledNote'));
        render(data);
      } catch (_) {
        note(t('statsLoadFailed'));
      }
    }

    toggle.addEventListener('change', async () => {
      const next = toggle.checked;
      toggle.disabled = true;
      try {
        await post('stats-settings', { enabled: next });
        await load();
      } catch (_) {
        toggle.checked = !next;
        note(t('statsLoadFailed'));
      } finally {
        toggle.disabled = false;
      }
    });
    $('stats-range').addEventListener('change', load);
    $('stats-reset').addEventListener('click', async () => {
      if (!confirm(t('statsResetConfirm'))) return;
      try {
        await post('stats-reset');
        await load();
      } catch (_) {
        note(t('statsLoadFailed'));
      }
    });
    window.addEventListener('image-map-language-change', load);
    load();
  });
})();
