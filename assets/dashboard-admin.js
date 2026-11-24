/*
 * Owner dashboard: the default view of the admin page. Everything comes from one request
 * (api.php?action=dashboard); "running now" is worked out in the browser from the programme
 * data, with the same helpers the visitor page uses, so it matches the visitor's now/next strip.
 */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.ADMIN_ROLE !== 'owner') return;
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;
    const t = (key) => window.AppI18n.t(key);
    const core = window.BurnigatorTimetable;
    const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let last = null;
    let loading = null;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const dateFormat = () =>
      new Intl.DateTimeFormat(window.AppI18n.lang() === 'de' ? 'de-DE' : 'en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    const when = (value) => {
      const time = Date.parse(value || '');
      return Number.isFinite(time) ? dateFormat().format(new Date(time)) : t('dashboardNever');
    };
    const card = (titleKey, ...children) => {
      const section = el('section', 'config-card dashboard-card');
      section.append(el('h3', '', t(titleKey)), ...children);
      return section;
    };
    const tile = (value, labelKey) => {
      const box = el('div', 'stats-total');
      box.append(el('strong', '', String(value)), el('span', '', t(labelKey)));
      return box;
    };
    const tiles = (list) => {
      const host = el('div', 'stats-totals');
      list.forEach(([value, label]) => host.append(tile(value, label)));
      return host;
    };
    const pill = (ok, text) => el('p', 'database-status ' + (ok ? 'is-ok' : 'is-error'), text);
    const link = (labelKey, onClick) => {
      const button = el('button', 'button button-secondary', t(labelKey));
      button.type = 'button';
      button.addEventListener('click', onClick);
      return button;
    };
    const openView = (view) => window.dispatchEvent(new CustomEvent('admin-open-view', { detail: view }));

    // Events that run right now and the next ones today (client clock, like the visitor page).
    function runningEvents(owners) {
      const now = new Date();
      const today = weekdayKeys[now.getDay()];
      const entries = [];
      owners.forEach((owner) =>
        core
          .timelineItems(owner.id, owner.program, today, () => true)
          .forEach((item) => entries.push({ ownerName: owner.name, item }))
      );
      return core.currentAndUpcoming(entries, now.getHours() * 60 + now.getMinutes(), 3);
    }
    function eventList(entries, emptyKey) {
      if (!entries.length) return el('p', 'hint', t(emptyKey));
      const list = el('ul', 'dashboard-list');
      entries.forEach((entry) => {
        const row = el('li');
        row.append(
          el('time', '', core.eventTimeLabel(entry.item.event, entry.item)),
          el('strong', '', entry.item.event.text || ''),
          el('small', '', entry.ownerName)
        );
        list.append(row);
      });
      return list;
    }

    function statusCard(d) {
      return card(
        'dashboardEventTitle',
        el('h4', 'dashboard-event-name', d.title || '–'),
        pill(d.published, t(d.published ? 'dashboardPublished' : 'dashboardUnpublished')),
        el('p', 'hint', t('dashboardLastSaved') + ': ' + when(d.updatedAt))
      );
    }
    function countsCard(d) {
      const c = d.counts;
      return card(
        'dashboardContentTitle',
        tiles([
          [c.pois, 'dashboardPois'],
          [c.poisWithProgram, 'dashboardPoisProgram'],
          [c.timelines, 'dashboardTimelines'],
          [c.events, 'dashboardEvents'],
          [c.eventsWithOwner, 'dashboardEventsOwned'],
        ])
      );
    }
    function nowCard(d) {
      const { now, next } = runningEvents(d.owners || []);
      return card(
        'dashboardNowTitle',
        el('h4', '', t('nowNextNow')),
        eventList(now, 'dashboardNothingNow'),
        el('h4', '', t('nowNextNext')),
        eventList(next, 'dashboardNothingNext')
      );
    }
    function databaseCard(d) {
      const db = d.database;
      let text = t('databaseStateNone');
      if (db.configured)
        text = db.ready
          ? (db.name
              ? t('databaseStateReady')
                  .replace('{name}', db.name)
                  .replace('{host}', db.host || '')
              : t('databaseStateConnected')) + (db.latencyMs !== null ? ' · ' + db.latencyMs + ' ms' : '')
          : t('databaseStateFailed');
      if (db.ready && db.queryFailed) text = t('dashboardDatabaseQueryFailed');
      const parts = [pill(db.configured && db.ready && !db.queryFailed, text)];
      if (!db.driverAvailable) parts.push(el('p', 'hint', t('setupDatabaseUnavailable')));
      if (!db.configured || !db.ready)
        parts.push(
          link('databaseSetupLink', () => {
            openView('config');
            document.querySelector('[data-goto-database]')?.click();
          })
        );
      return card('databaseTitle', ...parts);
    }
    function pinboardCard(d) {
      const p = d.pinboard;
      const parts = [pill(p.enabled, t(p.enabled ? 'dashboardPinboardOn' : 'dashboardPinboardOff'))];
      if (p.available) {
        parts.push(
          tiles([
            [p.posts, 'dashboardPinboardPosts'],
            [p.hidden, 'dashboardPinboardHidden'],
          ]),
          el('p', 'hint', t('dashboardPinboardLast') + ': ' + when(p.lastPostAt))
        );
      } else parts.push(el('p', 'hint', t('pinboardDatabaseRequired')));
      parts.push(link('dashboardPinboardOpen', () => openView('pinboard')));
      return card('dashboardPinboardTitle', ...parts);
    }
    function ordersCard(d) {
      const o = d.orders;
      if (!o.available) return card('dashboardOrdersTitle', el('p', 'hint', t('dashboardOrdersNone')));
      const sync = o.lastSyncAt ? t('lastSync') + ': ' + when(o.lastSyncAt) : t('dashboardOrdersNeverSynced');
      const parts = [
        tiles([
          [o.total, 'dashboardOrdersTotal'],
          [o.eligible, 'dashboardOrdersEligible'],
          [o.ineligible, 'dashboardOrdersBlocked'],
        ]),
        el('p', 'hint', sync),
      ];
      if (o.groups.length) {
        const table = el('table', 'stats-table');
        const head = table.createTHead().insertRow();
        [
          'eventAuthOrderStatus',
          'eventAuthOrderSource',
          'eventAuthOrderAccess',
          'eventAuthOrderCount',
        ].forEach((key) => head.append(el('th', '', t(key))));
        const body = table.createTBody();
        o.groups.forEach((g) => {
          const row = body.insertRow();
          row.append(
            el('td', '', g.status),
            el('td', '', t(g.source === 'pretix' ? 'eventAuthSourcePretix' : 'eventAuthSourceCsv')),
            el('td', '', t(g.eligible ? 'eventAuthOrderAllowed' : 'eventAuthOrderBlocked')),
            el('td', 'num', String(g.count))
          );
        });
        const wrap = el('div', 'stats-table-wrap');
        wrap.append(table);
        parts.push(wrap);
      }
      const wide = card('dashboardOrdersTitle', ...parts);
      wide.classList.add('is-wide');
      return wide;
    }
    function statsCard(d) {
      const s = d.stats;
      if (!s.enabled)
        return card(
          'dashboardStatsTitle',
          el('p', 'hint', t('statsDisabledNote')),
          link('dashboardStatsOpen', () => openView('config'))
        );
      const bars = el('div', 'stats-bars');
      bars.setAttribute('role', 'img');
      const max = Math.max(1, ...s.perDay.map((x) => x.visits));
      s.perDay.forEach((x) => {
        const bar = el('span', 'stats-bar');
        bar.style.height = Math.max(2, (x.visits / max) * 100) + '%';
        bar.title = x.day + ': ' + x.visits;
        bars.append(bar);
      });
      bars.setAttribute(
        'aria-label',
        t('statsVisitsPerDay') + ': ' + s.perDay.map((x) => x.day + ' ' + x.visits).join(', ')
      );
      return card(
        'dashboardStatsTitle',
        tiles([
          [s.totals.visits, 'statsVisits'],
          [s.totals.eventOpens, 'statsEventOpens'],
          [s.totals.poiOpens, 'statsPoiOpens'],
          [s.totals.favorites, 'statsFavorites'],
        ]),
        bars,
        el('p', 'hint', t('dashboardStatsRange'))
      );
    }
    function historyCard(d) {
      const parts = [];
      if (!d.history.length) parts.push(el('p', 'hint', t('historyEmpty')));
      else {
        const list = el('ul', 'dashboard-list');
        d.history.forEach((item) => {
          const row = el('li');
          let what = t('history_' + item.action);
          if (item.count) what += ' (' + item.count + ')';
          row.append(
            el('time', '', when(item.at)),
            el('strong', '', what),
            el(
              'small',
              '',
              (item.username || 'owner') +
                ' · ' +
                (item.role || 'owner') +
                (item.detail ? ' · ' + item.detail : '')
            )
          );
          list.append(row);
        });
        parts.push(list);
      }
      parts.push(link('dashboardHistoryOpen', () => openView('config')));
      const wide = card('historyHeading', ...parts);
      wide.classList.add('is-wide');
      return wide;
    }

    function render(d) {
      grid.replaceChildren(
        statusCard(d),
        countsCard(d),
        nowCard(d),
        databaseCard(d),
        pinboardCard(d),
        ordersCard(d),
        statsCard(d),
        historyCard(d)
      );
    }

    // One request at a time: the page-load fetch and the "view shown" event can overlap.
    function load() {
      loading ??= (async () => {
        const status = document.getElementById('dashboard-status');
        try {
          const response = await fetch('api.php?action=dashboard', {
            credentials: 'same-origin',
            cache: 'no-store',
          });
          if (!response.ok) throw new Error('http');
          last = await response.json();
          render(last);
          status.textContent = t('dashboardUpdated') + ': ' + dateFormat().format(new Date());
        } catch (_) {
          status.textContent = t('dashboardLoadFailed');
        } finally {
          loading = null;
        }
      })();
      return loading;
    }

    document.getElementById('dashboard-refresh').addEventListener('click', load);
    window.addEventListener('admin-dashboard-shown', load);
    window.addEventListener('image-map-language-change', () => last && render(last));
    setInterval(() => {
      if (!document.getElementById('admin-dashboard-view').hidden && !document.hidden) load();
    }, 60000);
    load();
  });
})();
