(function () {
  function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(','),
      type = dataUrl.slice(5, dataUrl.indexOf(';')),
      binary = atob(dataUrl.slice(comma + 1)),
      bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type });
  }
  // admin.js may finish before this script has loaded, so do not rely on the event alone.
  if (window.BurnigatorAdminReady) initialize();
  else window.addEventListener('burnigator-admin-ready', initialize, { once: true });
  function initialize() {
    const api = window.BurnigatorAdminBackup;
    if (!api || window.ADMIN_ROLE !== 'owner') return;
    const backupButton = document.getElementById('export-map');
    const backupInput = document.getElementById('import-map');
    if (backupButton) {
      backupButton.textContent = window.AppI18n.t('exportData');
      backupButton.onclick = exportFullBackup;
    }
    if (backupInput) {
      backupInput.accept = 'application/json,.json';
      backupInput.onchange = restoreFullBackup;
    }
    createSnapshotControls();
    refreshSnapshots();
    window.addEventListener('burnigator-map-saved', refreshSnapshots);

    async function exportFullBackup() {
      backupButton.disabled = true;
      try {
        const map = JSON.parse(JSON.stringify(api.getData()));
        const assets = {
          image: await assetData(map.image, 'image'),
          logo: await assetData(map.logo, 'logo'),
          favicon: await assetData(map.favicon, 'favicon'),
        };
        for (const kind of ['image', 'logo', 'favicon']) {
          if (map[kind] && !assets[kind]) throw new Error(window.AppI18n.t('backupFailed'));
        }
        const bundle = {
          format: 'burnigator-full-backup',
          version: 1,
          createdAt: new Date().toISOString(),
          map,
          assets,
        };
        const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
          url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download = window.AppI18n.t('backupFilename');
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        api.say(window.AppI18n.t('exportSuccess'));
      } catch (error) {
        api.say(
          error.message === 'map_conflict'
            ? window.AppI18n.t('mapConflict')
            : error.message || window.AppI18n.t('backupFailed'),
          true
        );
      } finally {
        backupButton.disabled = false;
      }
    }

    async function assetData(path, kind) {
      if (!path) return null;
      if (!/^uploads\/(?:map-[a-f0-9]{24}\.(?:png|jpg)|(?:logo|favicon)-[a-f0-9]{24}\.png)$/.test(path))
        throw new Error(window.AppI18n.t('backupFailed'));
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(window.AppI18n.t('backupFailed'));
      const blob = await response.blob();
      if (kind !== 'image' && blob.type !== 'image/png') throw new Error(window.AppI18n.t('backupFailed'));
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(window.AppI18n.t('backupFailed')));
        reader.readAsDataURL(blob);
      });
    }

    async function restoreFullBackup(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > 80 * 1024 * 1024) {
        api.say(window.AppI18n.t('backupTooLarge'), true);
        return;
      }
      if (!confirm(window.AppI18n.t('fullBackupConfirm'))) return;
      backupInput.disabled = true;
      try {
        const bundle = JSON.parse(await file.text());
        if (
          bundle?.format !== 'burnigator-full-backup' ||
          bundle.version !== 1 ||
          !bundle.map ||
          !bundle.assets ||
          !Array.isArray(bundle.map.categories) ||
          !Array.isArray(bundle.map.pois)
        )
          throw new Error(window.AppI18n.t('backupInvalid'));
        const assets = {};
        for (const kind of ['image', 'logo', 'favicon']) {
          const dataUrl = bundle.assets[kind];
          if (!dataUrl) {
            assets[kind] = '';
            if (kind === 'image' && bundle.map.image) throw new Error(window.AppI18n.t('backupInvalid'));
            continue;
          }
          if (
            typeof dataUrl !== 'string' ||
            !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)
          )
            throw new Error(window.AppI18n.t('backupInvalid'));
          const blob = dataUrlToBlob(dataUrl);
          if (blob.size > (kind === 'image' ? 20 : 5) * 1024 * 1024)
            throw new Error(window.AppI18n.t('backupInvalid'));
          const form = new FormData();
          form.append('image', blob, 'backup-' + kind + (blob.type === 'image/jpeg' ? '.jpg' : '.png'));
          const response = await fetch('api.php?action=restore-asset&kind=' + kind, {
            method: 'POST',
            headers: { 'X-CSRF-Token': window.MAP_CSRF },
            body: form,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || window.AppI18n.t('backupFailed'));
          assets[kind] = result.path;
        }
        const response = await fetch('api.php?action=restore-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
          body: JSON.stringify({ map: bundle.map, assets, expectedUpdatedAt: api.getData().updatedAt || '' }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || window.AppI18n.t('backupFailed'));
        api.setData(result.map);
        api.say(window.AppI18n.t('backupRestored'));
        refreshSnapshots();
        api.refreshHistory();
      } catch (error) {
        api.say(
          error.message === 'map_conflict'
            ? window.AppI18n.t('mapConflict')
            : error.message || window.AppI18n.t('backupFailed'),
          true
        );
      } finally {
        backupInput.disabled = false;
      }
    }

    function createSnapshotControls() {
      const ownerTools = document.getElementById('owner-tools');
      if (!ownerTools) return;
      const wrap = document.createElement('section');
      wrap.className = 'snapshot-tools';
      wrap.id = 'snapshot-tools';
      const heading = document.createElement('h2');
      heading.dataset.i18n = 'snapshotsHeading';
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.dataset.i18n = 'snapshotsHint';
      const select = document.createElement('select');
      select.id = 'snapshot-select';
      select.setAttribute('aria-label', window.AppI18n.t('restoreSnapshot'));
      const option = document.createElement('option');
      option.value = '';
      option.textContent = window.AppI18n.t('snapshotsEmpty');
      select.appendChild(option);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button-secondary subtle';
      button.id = 'restore-snapshot';
      button.dataset.i18n = 'restoreSnapshot';
      button.disabled = true;
      select.onchange = () => (button.disabled = !select.value);
      button.onclick = restoreSnapshot;
      wrap.append(heading, hint, select, button);
      const securityPanel = document.querySelector('[data-config-section="configTabSecurity"]');
      const historyCard = securityPanel
        ?.querySelector('[data-i18n="historyHeading"]')
        ?.closest('.config-card');
      if (historyCard?.parentElement) historyCard.parentElement.insertBefore(wrap, historyCard.nextSibling);
      else if (securityPanel) securityPanel.appendChild(wrap);
      else ownerTools.appendChild(wrap);
      window.AppI18n.apply();
      window.addEventListener('image-map-language-change', () => {
        select.setAttribute('aria-label', window.AppI18n.t('restoreSnapshot'));
        if (!select.value && select.options.length === 1)
          select.options[0].textContent = window.AppI18n.t('snapshotsEmpty');
      });
    }

    async function refreshSnapshots() {
      const select = document.getElementById('snapshot-select');
      if (!select) return;
      try {
        const response = await fetch('api.php?action=snapshots', { cache: 'no-store' }),
          result = await response.json();
        if (!response.ok) throw new Error();
        const selected = select.value;
        select.replaceChildren();
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = window.AppI18n.t('snapshotsEmpty');
        select.appendChild(empty);
        (result.snapshots || []).forEach((snapshot) => {
          const option = document.createElement('option');
          option.value = snapshot.id;
          const date = new Intl.DateTimeFormat(window.AppI18n.lang() === 'de' ? 'de-DE' : 'en-GB', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(snapshot.at));
          option.textContent = date + ' · ' + snapshot.title + ' · ' + snapshot.pois + ' POIs';
          select.appendChild(option);
        });
        select.value = (result.snapshots || []).some((item) => item.id === selected) ? selected : '';
        document.getElementById('restore-snapshot').disabled = !select.value;
      } catch (_) {
        api.say(window.AppI18n.t('snapshotsLoadFailed'), true);
      }
    }

    async function restoreSnapshot() {
      const select = document.getElementById('snapshot-select');
      if (!select.value || !confirm(window.AppI18n.t('snapshotConfirm'))) return;
      const button = document.getElementById('restore-snapshot');
      button.disabled = true;
      try {
        const response = await fetch('api.php?action=restore-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
          body: JSON.stringify({ id: select.value, expectedUpdatedAt: api.getData().updatedAt || '' }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || window.AppI18n.t('snapshotRestoreFailed'));
        api.setData(result.map);
        api.say(window.AppI18n.t('snapshotRestored'));
        api.refreshHistory();
        refreshSnapshots();
      } catch (error) {
        api.say(error.message || window.AppI18n.t('snapshotRestoreFailed'), true);
        button.disabled = !select.value;
      }
    }
  }
})();
