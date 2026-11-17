(function () {
  const pending = [];
  let initialized = false,
    enabled = false;
  const queue = (window._paq = window._paq || []);
  function track(command) {
    if (initialized) {
      if (enabled) queue.push(command);
    } else pending.push(command);
  }
  window.trackAppEvent = function (category, action, name) {
    track(
      name == null
        ? ['trackEvent', String(category), String(action)]
        : ['trackEvent', String(category), String(action), String(name)]
    );
  };
  document.addEventListener('change', function (event) {
    if (event.target && event.target.id === 'language-switch')
      window.trackAppEvent('App', 'language_change', event.target.value);
  });
  function start(settings) {
    const base = typeof settings?.matomoUrl === 'string' ? settings.matomoUrl.trim() : '';
    const id = String(settings?.matomoSiteId || '7');
    if (!base) {
      initialized = true;
      enabled = false;
      pending.length = 0;
      return;
    }
    let url;
    try {
      url = new URL(base, document.baseURI);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\d{1,9}$/.test(id) ||
        Number(id) < 1
      )
        throw new Error('invalid');
    } catch (_) {
      initialized = true;
      enabled = false;
      pending.length = 0;
      return;
    }
    const trackerUrl = url.href.replace(/\/+$/, '') + '/';
    queue.push(['setTrackerUrl', trackerUrl + 'matomo.php']);
    queue.push(['setSiteId', id]);
    queue.push(['disableCookies']);
    queue.push(['trackPageView']);
    queue.push(['enableLinkTracking']);
    pending.splice(0).forEach((command) => queue.push(command));
    enabled = true;
    initialized = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = trackerUrl + 'matomo.js';
    const first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(script, first);
  }
  fetch('api.php', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('settings');
      return response.json();
    })
    .then(start)
    .catch(() => start({ matomoUrl: 'https://www.minmon.de/piwik/', matomoSiteId: '7' }));
})();
