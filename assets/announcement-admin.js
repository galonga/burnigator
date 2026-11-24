(function () {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.ADMIN_ROLE !== 'owner') return;
    const $ = (id) => document.getElementById(id);
    const text = $('announcement-text');
    if (!text) return;
    const t = (key) => window.AppI18n.t(key);
    const say = (key) => ($('announcement-status').textContent = key ? t(key) : '');

    function fill(announcement) {
      text.value = announcement?.text || '';
      $('announcement-level').value = announcement?.level === 'warning' ? 'warning' : 'info';
    }

    async function load() {
      try {
        const response = await fetch('api.php', { credentials: 'same-origin', cache: 'no-store' });
        if (response.ok) fill((await response.json()).announcement);
      } catch (_) {}
    }

    async function save(clear) {
      const body = clear ? { text: '' } : { text: text.value, level: $('announcement-level').value };
      try {
        const response = await fetch('api.php?action=announcement-save', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': window.MAP_CSRF },
          body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'failed');
        fill(result.announcement);
        say(result.announcement ? 'announcementSaved' : 'announcementRemoved');
      } catch (_) {
        say('announcementFailed');
      }
    }

    $('announcement-save').addEventListener('click', () => save(!text.value.trim()));
    $('announcement-clear').addEventListener('click', () => save(true));
    load();
  });
})();
