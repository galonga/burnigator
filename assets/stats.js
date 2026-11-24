/*
 * Built-in anonymous statistics (visitor side). Sends one tiny beacon per interesting action:
 * { type, id }. No cookie, no identifier and nothing personal is sent or stored; the server only
 * increments a daily counter. Honors Do Not Track and Global Privacy Control, and does nothing
 * unless the owner switched statistics on (the map data says so).
 */
(function () {
  let enabled = false;
  const seen = new Set();

  function optedOut() {
    return (
      navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true
    );
  }

  function send(type, id) {
    const body = JSON.stringify({ type, id: id || '' });
    try {
      if (
        navigator.sendBeacon &&
        navigator.sendBeacon('api.php?action=stat', new Blob([body], { type: 'text/plain' }))
      )
        return;
      fetch('api.php?action=stat', { method: 'POST', body, keepalive: true, credentials: 'omit' }).catch(
        () => {}
      );
    } catch (_) {}
  }

  window.BurnigatorStats = {
    init(settings) {
      enabled = settings?.statsEnabled === true && settings?.published !== false && !optedOut();
      if (enabled) this.hit('visit');
    },
    // Counts once per page load for the same thing, so reopening a dialog does not inflate numbers.
    hit(type, id) {
      if (!enabled) return;
      const key = type + '|' + (id || '');
      if (seen.has(key)) return;
      seen.add(key);
      send(type, id);
    },
    // Favourite toggles are real actions each time, so they are not de-duplicated.
    action(type, id) {
      if (enabled) send(type, id);
    },
  };
})();
