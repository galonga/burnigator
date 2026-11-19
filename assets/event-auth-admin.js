(function () {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.ADMIN_ROLE !== 'owner') return;
    const $ = (id) => document.getElementById(id),
      status = $('event-auth-status'),
      pinboardToggle = $('pinboard-enabled');
    async function jsonRequest(url, body) {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': window.MAP_CSRF },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || 'failed');
        error.result = result;
        throw error;
      }
      return result;
    }
    function guardConfirmed(result) {
      const t = window.AppI18n.t;
      return confirm(
        t('eventAuthSyncGuard')
          .replace('{before}', result.eligibleBefore)
          .replace('{after}', result.counts?.eligible ?? 0)
      );
    }
    function renderOrderGroups(groups) {
      const host = $('event-auth-order-overview');
      if (!host) return;
      host.replaceChildren();
      if (!groups?.length) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.textContent = window.AppI18n.t('eventAuthOrderOverviewEmpty');
        host.append(empty);
        return;
      }
      const table = document.createElement('table'),
        thead = document.createElement('thead'),
        headRow = document.createElement('tr'),
        tbody = document.createElement('tbody');
      table.className = 'event-auth-order-table';
      [
        ['eventAuthOrderStatus', 'status'],
        ['eventAuthOrderSource', 'source'],
        ['eventAuthOrderAccess', 'access'],
        ['eventAuthOrderCount', 'count'],
      ].forEach(([key]) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = window.AppI18n.t(key);
        headRow.append(th);
      });
      thead.append(headRow);
      groups.forEach((group) => {
        const row = document.createElement('tr'),
          statusCell = document.createElement('td'),
          sourceCell = document.createElement('td'),
          accessCell = document.createElement('td'),
          countCell = document.createElement('td');
        statusCell.textContent = group.status;
        sourceCell.textContent = window.AppI18n.t(
          group.source === 'pretix' ? 'eventAuthSourcePretix' : 'eventAuthSourceCsv'
        );
        accessCell.textContent = window.AppI18n.t(
          group.eligible ? 'eventAuthOrderAllowed' : 'eventAuthOrderBlocked'
        );
        countCell.textContent = String(group.count);
        row.append(statusCell, sourceCell, accessCell, countCell);
        tbody.append(row);
      });
      table.append(thead, tbody);
      host.append(table);
    }
    function showSummary(result) {
      const t = window.AppI18n.t,
        eligible = result.counts?.eligible ?? 0,
        ineligible = result.counts?.ineligible ?? 0,
        total = result.counts?.total ?? result.counts?.imported ?? eligible + ineligible;
      status.textContent =
        (result.lastSyncAt
          ? t('lastSync') + ': ' + new Date(result.lastSyncAt).toLocaleString() + ' · '
          : '') +
        t('eventAuthCounts')
          .replace('{total}', total)
          .replace('{eligible}', eligible)
          .replace('{ineligible}', ineligible);
      renderOrderGroups(result.orderGroups);
    }
    async function loadPinboardSetting() {
      try {
        const response = await fetch('api.php?action=pinboard-status', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const result = await response.json();
        if (response.ok) pinboardToggle.checked = result.enabled === true;
      } catch (_) {}
    }
    pinboardToggle?.addEventListener('change', async () => {
      const next = pinboardToggle.checked;
      pinboardToggle.disabled = true;
      try {
        const result = await jsonRequest('api.php?action=pinboard-settings', { enabled: next });
        pinboardToggle.checked = result.enabled === true;
        await loadModeration();
      } catch (_) {
        pinboardToggle.checked = !next;
        status.textContent = window.AppI18n.t('eventAuthActionFailed');
      } finally {
        pinboardToggle.disabled = false;
      }
    });
    function gotoDatabaseCard() {
      const card = $('database-heading')?.closest('.config-card');
      if (!card) return;
      $('admin-config-tab')?.click();
      const panel = card.closest('.config-section-panel');
      if (panel) document.getElementById(panel.getAttribute('aria-labelledby'))?.click();
      card.scrollIntoView?.({ block: 'start' });
      $('database-host')?.focus({ preventScroll: true });
    }
    document
      .querySelectorAll('[data-goto-database]')
      .forEach((button) => button.addEventListener('click', gotoDatabaseCard));
    async function loadDatabase() {
      const t = window.AppI18n.t,
        state = $('database-status'),
        pinboardState = $('pinboard-database-state'),
        notice = $('event-auth-database-notice');
      try {
        const response = await fetch('api.php?action=database-status', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) throw new Error();
        const text = !result.configured
          ? t('databaseStateNone')
          : result.ready
            ? result.name
              ? t('databaseStateReady')
                  .replace('{name}', result.name)
                  .replace('{host}', result.host || '')
              : t('databaseStateConnected')
            : t('databaseStateFailed');
        [state, pinboardState].forEach((el) => {
          if (!el) return;
          el.textContent = text;
          el.classList.toggle('is-ok', !!result.ready);
          el.classList.toggle('is-error', !result.ready);
        });
        if (notice) notice.hidden = !!result.ready;
        $('database-host').value = result.managedByEnvironment ? '' : result.host || '';
        $('database-name').value = result.managedByEnvironment ? '' : result.name || '';
        $('database-user').value = result.managedByEnvironment ? '' : result.user || '';
        $('database-password').placeholder = result.passwordSet ? '••••••••' : '';
        $('database-managed-note').hidden = !result.managedByEnvironment;
        $('database-form').hidden = !!result.managedByEnvironment;
        $('remove-database').hidden = !result.configured || !!result.managedByEnvironment;
        if (!result.driverAvailable) state.textContent += ' ' + t('setupDatabaseUnavailable');
      } catch (_) {
        if (pinboardState) pinboardState.textContent = '';
      }
    }
    async function saveDatabase(remove) {
      const t = window.AppI18n.t,
        state = $('database-status'),
        buttons = [$('save-database'), $('remove-database')];
      if (remove && !confirm(t('databaseRemoveConfirm'))) return;
      buttons.forEach((button) => (button.disabled = true));
      try {
        await jsonRequest(
          'api.php?action=database-settings',
          remove
            ? { remove: true }
            : {
                host: $('database-host').value,
                name: $('database-name').value,
                user: $('database-user').value,
                password: $('database-password').value,
              }
        );
        $('database-password').value = '';
        await loadDatabase();
        await load();
        state.textContent = t(remove ? 'databaseRemoved' : 'databaseSaved') + ' ' + state.textContent;
      } catch (error) {
        const keys = {
          database_incomplete: 'setupDatabaseIncomplete',
          database_driver_missing: 'setupDatabaseUnavailable',
          database_connection_failed: 'setupDatabaseConnection',
          database_managed_by_environment: 'databaseManagedByEnvironment',
          database_config_not_writable: 'databaseConfigNotWritable',
        };
        state.textContent = t(keys[error.message] || 'eventAuthActionFailed');
        state.classList.remove('is-ok');
        state.classList.add('is-error');
      } finally {
        buttons.forEach((button) => (button.disabled = false));
      }
    }
    $('save-database')?.addEventListener('click', () => saveDatabase(false));
    $('remove-database')?.addEventListener('click', () => saveDatabase(true));
    async function load() {
      try {
        const response = await fetch('api.php?action=event-auth-admin', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const result = await response.json();
        const httpWarning = $('event-auth-http-warning');
        if (httpWarning) httpWarning.hidden = result.https !== false;
        if (!response.ok) throw new Error('unavailable');
        $('pretix-base-url').value = result.settings.pretix_base_url || '';
        $('pretix-organizer').value = result.settings.pretix_organizer || '';
        $('pretix-event').value = result.settings.pretix_event || '';
        $('pretix-token').placeholder = result.settings.tokenConfigured
          ? '••••••••'
          : window.AppI18n.t('pretixToken');
        showSummary(result);
        if (!result.secretReady) status.textContent = window.AppI18n.t('eventAuthSetupHelp');
        await loadModeration();
      } catch (_) {
        status.textContent = window.AppI18n.t('eventAuthSetupHelp');
      }
    }
    async function loadModeration() {
      const host = $('admin-pinboard-posts');
      if (!host) return;
      try {
        const response = await fetch('api.php?action=pinboard', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) throw new Error();
        host.replaceChildren();
        (result.posts || []).forEach((post) => {
          const card = document.createElement('article');
          card.className = 'pinboard-post' + (post.hidden ? ' is-hidden' : '');
          const head = document.createElement('strong');
          head.className = 'pinboard-author';
          head.append(window.BurnigatorAvatar.create(post.pseudonym), post.pseudonym);
          const body = document.createElement('p');
          body.textContent = post.body;
          const controls = document.createElement('div');
          controls.className = 'pinboard-actions';
          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'button button-secondary';
          toggle.textContent = window.AppI18n.t(post.hidden ? 'pinboardShow' : 'pinboardHide');
          toggle.onclick = async () => {
            await jsonRequest('api.php?action=pinboard-moderate', {
              id: post.id,
              mode: post.hidden ? 'show' : 'hide',
            });
            loadModeration();
          };
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'button button-outlined';
          remove.textContent = window.AppI18n.t('pinboardDelete');
          remove.onclick = async () => {
            if (!confirm(window.AppI18n.t('pinboardDeleteConfirm'))) return;
            await jsonRequest('api.php?action=pinboard-moderate', { id: post.id, mode: 'delete' });
            loadModeration();
          };
          controls.append(toggle, remove);
          card.append(head, body, controls);
          host.append(card);
        });
      } catch (_) {
        host.textContent = window.AppI18n.t('pinboardModerationUnavailable');
      }
    }
    $('admin-pinboard-tab')?.addEventListener('click', loadModeration);
    $('save-event-auth')?.addEventListener('click', async () => {
      try {
        await jsonRequest('api.php?action=event-auth-settings', {
          pretix_base_url: $('pretix-base-url').value,
          pretix_organizer: $('pretix-organizer').value,
          pretix_event: $('pretix-event').value,
          pretix_token: $('pretix-token').value,
        });
        $('pretix-token').value = '';
        status.textContent = window.AppI18n.t('eventAuthSaved');
        await load();
      } catch (_) {
        status.textContent = window.AppI18n.t('eventAuthActionFailed');
      }
    });
    $('sync-pretix')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        try {
          await jsonRequest('api.php?action=event-auth-sync', {});
        } catch (error) {
          if (error.message !== 'sync_guard' || !guardConfirmed(error.result)) throw error;
          await jsonRequest('api.php?action=event-auth-sync', { force: true });
        }
        await load();
        status.textContent = window.AppI18n.t('eventAuthSyncDone') + ' ' + status.textContent;
      } catch (_) {
        status.textContent = window.AppI18n.t('eventAuthActionFailed');
      } finally {
        button.disabled = false;
      }
    });
    $('import-orders-csv')?.addEventListener('click', async (event) => {
      const file = $('orders-csv').files[0];
      if (!file) {
        status.textContent = window.AppI18n.t('eventAuthActionFailed');
        return;
      }
      const button = event.currentTarget;
      button.disabled = true;
      const send = async (force) => {
        const form = new FormData();
        form.append('csv', file);
        if (force) form.append('force', '1');
        const response = await fetch('api.php?action=event-auth-import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-CSRF-TOKEN': window.MAP_CSRF },
          body: form,
        });
        const result = await response.json().catch(() => ({}));
        return { response, result };
      };
      try {
        let { response, result } = await send(false);
        if (response.status === 409 && result.error === 'sync_guard') {
          if (!guardConfirmed(result)) throw new Error('cancelled');
          ({ response } = await send(true));
        }
        if (!response.ok) throw new Error();
        await load();
        status.textContent = window.AppI18n.t('eventAuthImportDone') + ' ' + status.textContent;
        $('orders-csv').value = '';
      } catch (_) {
        status.textContent = window.AppI18n.t('eventAuthActionFailed');
      } finally {
        button.disabled = false;
      }
    });
    $('reset-application')?.addEventListener('click', async (event) => {
      const phrase = $('reset-app-confirm'),
        password = $('reset-app-password'),
        message = $('reset-app-status');
      if (!confirm(window.AppI18n.t('resetAppDialog'))) return;
      if (phrase.value.trim() !== 'RESET BURNIGATOR') {
        message.textContent = window.AppI18n.t('resetAppPhraseMismatch');
        phrase.focus();
        return;
      }
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await jsonRequest('api.php?action=reset-application', {
          confirmation: phrase.value.trim(),
          password: password.value,
        });
        message.textContent = window.AppI18n.t('resetAppDone');
        window.location.replace('setup.php');
      } catch (error) {
        message.textContent = window.AppI18n.t(
          error?.message === 'reset_partial' ? 'resetAppPartial' : 'resetAppFailed'
        );
        button.disabled = false;
        password.value = '';
        password.focus();
      }
    });
    loadDatabase();
    load();
    loadPinboardSetting();
  });
})();
