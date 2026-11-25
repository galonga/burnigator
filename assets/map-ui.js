// Small DOM helpers shared by the visitor page.
(function () {
  // WAI-ARIA tabs pattern: one tab stop per tablist, arrow keys / Home / End move between tabs.
  function enableTablistKeys(tablist) {
    if (!tablist || tablist.dataset.tabKeys) return;
    tablist.dataset.tabKeys = '1';
    const tabs = () => [...tablist.querySelectorAll('[role="tab"]')];
    const sync = () => {
      const all = tabs();
      const active = all.find((tab) => tab.getAttribute('aria-selected') === 'true') || all[0];
      all.forEach((tab) => (tab.tabIndex = tab === active ? 0 : -1));
    };
    tablist.addEventListener('keydown', (event) => {
      const all = tabs();
      const index = all.indexOf(document.activeElement);
      if (index < 0) return;
      const next = {
        ArrowRight: (index + 1) % all.length,
        ArrowLeft: (index + all.length - 1) % all.length,
        Home: 0,
        End: all.length - 1,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      all[next].focus();
      all[next].click();
    });
    new MutationObserver(sync).observe(tablist, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
    sync();
  }
  function makeGlyph(value, mode) {
    const colorClass = mode === 'colored' ? ' color-mode' : '';
    if (/^fa-[a-z0-9-]{2,60}$/.test(value || '')) {
      const glyph = document.createElement('i');
      glyph.className = 'poi-glyph fa-solid ' + value + colorClass;
      return glyph;
    }
    const glyph = document.createElement('span');
    glyph.className = 'poi-glyph' + colorClass;
    glyph.textContent = value || '•';
    return glyph;
  }
  function safeColor(c) {
    return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#E94F85';
  }
  window.BurnigatorMapUi = { enableTablistKeys, makeGlyph, safeColor };
})();
