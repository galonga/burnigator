(function () {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.ADMIN_ROLE !== 'owner') return;
    const nav = document.getElementById('config-section-tabs');
    const config = document.getElementById('admin-config-view');
    const general = document.getElementById('owner-settings');
    const ownerTools = document.getElementById('owner-tools');
    if (!nav || !config || !general || !ownerTools) return;
    general.hidden = false;
    ownerTools.hidden = false;
    const sections = [
      {
        key: 'configTabGeneral',
        ids: [
          'config-general-heading',
          'config-appearance-heading',
          'config-soundcloud-heading',
          'config-tracking-heading',
        ],
      },
      {
        key: 'configTabEvent',
        ids: ['config-categories-heading', 'publication-heading'],
      },
      {
        key: 'configTabUsers',
        ids: [
          'config-accounts-heading',
          'config-owner-password-heading',
          'database-heading',
          'event-auth-heading',
        ],
      },
      {
        key: 'configTabSecurity',
        ids: ['config-history-heading', 'config-data-heading', 'reset-app-heading'],
      },
    ];
    const cards = [...config.querySelectorAll('.config-card')];
    const byHeading = new Map(cards.map((card) => [card.querySelector('[id]')?.id, card]));
    const panels = [];
    sections.forEach((section, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'config-section-tab';
      button.id = 'config-section-tab-' + index;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'config-section-panel-' + index);
      button.setAttribute('data-i18n', section.key);
      button.textContent = window.AppI18n.t(section.key);
      const panel = document.createElement('div');
      panel.className = 'config-section-panel';
      panel.id = 'config-section-panel-' + index;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      panel.hidden = index !== 0;
      panel.dataset.configSection = section.key;
      section.ids.forEach((id) => {
        const card = byHeading.get(id);
        if (card) panel.appendChild(card);
      });
      nav.appendChild(button);
      config.insertBefore(panel, nav.nextSibling);
      panels.push(panel);
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const next = (index + (event.key === 'ArrowRight' ? 1 : sections.length - 1)) % sections.length;
          nav.querySelectorAll('[role="tab"]')[next].focus();
          select(next);
        }
      });
    });
    function select(active) {
      nav.querySelectorAll('[role="tab"]').forEach((button, index) => {
        const selected = index === active;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.tabIndex = selected ? 0 : -1;
        panels[index].hidden = !selected;
      });
    }
    select(0);
  });
})();
