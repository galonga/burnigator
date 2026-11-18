(async function () {
  let bootStage = 'start';
  try {
    const role = window.ADMIN_ROLE || 'owner';
    const ICON_OPTIONS = [...new Map((window.FA_ICON_OPTIONS || []).map((item) => [item[0], item])).values()];
    const programDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const enabledProgramDays = () =>
      Array.isArray(data.enabledDays) && data.enabledDays.some((day) => programDays.includes(day))
        ? programDays.filter((day) => data.enabledDays.includes(day))
        : programDays;
    const orderedProgramDays = () => {
      const first = Math.max(0, programDays.indexOf(data.weekStart));
      const enabled = enabledProgramDays();
      return [...programDays.slice(first), ...programDays.slice(0, first)].filter((day) =>
        enabled.includes(day)
      );
    };
    const setEnabledDayFields = () => {
      const enabled = enabledProgramDays();
      document.querySelectorAll('.enabled-day').forEach((box) => (box.checked = enabled.includes(box.value)));
    };
    const eventCategories = [
      ['performance', 'fa-masks-theater'],
      ['music', 'fa-music'],
      ['kink', 'fa-heart'],
      ['adultMind', 'fa-brain'],
      ['kidsMind', 'fa-people-group'],
      ['movement', 'fa-person-running'],
      ['quiet', 'fa-volume-low'],
      ['loud', 'fa-volume-high'],
      ['crafting', 'fa-scissors'],
    ];
    bootStage = 'map';
    const map = role === 'www' ? null : L.map('map', { crs: L.CRS.Simple, minZoom: -5, zoomSnap: 0.25 });
    let data = {
        title: 'Mein Event',
        image: '',
        width: 0,
        height: 0,
        qrUrl: '',
        soundcloudEnabled: true,
        soundcloudPlaylist: '',
        categories: [],
        pois: [],
        timelines: [],
      },
      markers = new Map();
    const status = document.getElementById('status');
    let roleSaveInProgress = false;
    const say = (s, bad = false) => {
      status.textContent = s;
      status.className = bad ? 'error' : 'success';
    };
    const themeFields = {
      primary: document.getElementById('theme-primary'),
      accent: document.getElementById('theme-accent'),
      alert: document.getElementById('theme-alert'),
      background: document.getElementById('theme-background'),
    };
    const readThemeFields = () =>
      window.BurnigatorTheme.normalize(
        Object.fromEntries(Object.entries(themeFields).map(([key, input]) => [key, input.value]))
      );
    const setThemeFields = (theme) => {
      const normalized = window.BurnigatorTheme.apply(theme);
      Object.entries(themeFields).forEach(([key, input]) => {
        input.value = normalized[key];
      });
      data.theme = normalized;
    };
    function showDataLoadError(message) {
      say(message, true);
      const host = document.getElementById('map');
      if (!host) return;
      const panel = document.createElement('div');
      panel.className = 'map-load-error';
      panel.setAttribute('role', 'alert');
      const text = document.createElement('p');
      text.textContent = message;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button-primary';
      retry.textContent = window.AppI18n.t('retry');
      retry.onclick = () => window.location.reload();
      panel.append(text, retry);
      host.replaceChildren(panel);
    }
    function userError(message) {
      if (message === 'poi_limit') return window.AppI18n.t('poiLimit');
      if (message === 'map_conflict') return window.AppI18n.t('mapConflict');
      if (message === 'invalid_event_time') return window.AppI18n.t('invalidEventTime');
      if (message === 'event_owner_code_invalid') return window.AppI18n.t('eventOwnerCodeInvalid');
      if (message === 'event_owner_unavailable') return window.AppI18n.t('eventOwnerUnavailable');
      if (message === 'soundcloud_playlist_invalid') return window.AppI18n.t('soundcloudPlaylistInvalid');
      if (message === 'timeline_name_required') return window.AppI18n.t('timelineNameRequired');
      if (message === 'invalid_timelines') return window.AppI18n.t('timelineLimit');
      if (message === 'password_mismatch') return window.AppI18n.t('passwordMismatch');
      if (message === 'password_too_short') return window.AppI18n.t('passwordShort');
      if (message === 'current_password_invalid') return window.AppI18n.t('currentPasswordInvalid');
      if (message === 'password_save_failed') return window.AppI18n.t('ownerPasswordFailed');
      if (window.AppI18n.lang() !== 'en') return message;
      if ((message || '').includes('20 MB')) return window.AppI18n.t('errorImageSize');
      if ((message || '').includes('gültige PNG')) return window.AppI18n.t('errorImageFormat');
      if ((message || '').includes('Schreibrechte') || (message || '').includes('beschreibbar'))
        return window.AppI18n.t('errorPermissions');
      if ((message || '').includes('Anmeldung')) return window.AppI18n.t('errorSession');
      return window.AppI18n.t('requestFailed');
    }
    bootStage = 'data';
    try {
      const result = await fetch('api.php', { cache: 'no-store', credentials: 'same-origin' });
      const payload = await result.json();
      if (!result.ok) {
        const message = payload?.error === 'not_published' ? 'adminPreviewDenied' : 'adminDataLoadFailed';
        showDataLoadError(window.AppI18n.t(message));
        return;
      }
      if (
        !payload ||
        typeof payload !== 'object' ||
        !Array.isArray(payload.categories) ||
        !Array.isArray(payload.pois)
      )
        throw new Error('invalid_admin_data');
      data = payload;
    } catch (_) {
      showDataLoadError(window.AppI18n.t('adminDataLoadFailed'));
      return;
    }
    bootStage = 'configuration';
    data.theme = window.BurnigatorTheme.apply(data.theme);
    const publicationStatus = document.getElementById('publication-status'),
      publicationToggle = document.getElementById('publication-toggle');
    function renderPublication() {
      if (!publicationStatus || !publicationToggle) return;
      const published = data.published !== false;
      publicationStatus.textContent = window.AppI18n.t(published ? 'sitePublished' : 'siteUnpublished');
      publicationToggle.textContent = window.AppI18n.t(published ? 'unpublishSite' : 'publishSite');
      publicationToggle.className = published
        ? 'button button-outlined button-danger'
        : 'button button-primary';
    }
    renderPublication();
    document.getElementById('owner-settings').hidden = role !== 'owner';
    document.getElementById('owner-tools').hidden = role !== 'owner';
    const adminLayout = document.querySelector('.admin-layout'),
      editView = document.getElementById('admin-edit-view'),
      configView = document.getElementById('admin-config-view'),
      pinboardView = document.getElementById('admin-pinboard-view'),
      editTab = document.getElementById('admin-edit-tab'),
      configTab = document.getElementById('admin-config-tab'),
      pinboardTab = document.getElementById('admin-pinboard-tab');
    const showAdminView = (view) => {
      const ownerView = role === 'owner' ? view : 'edit';
      const showEdit = ownerView === 'edit';
      const showConfig = ownerView === 'config';
      const showPinboard = ownerView === 'pinboard';
      editView.hidden = !showEdit;
      configView.hidden = !showConfig;
      if (pinboardView) pinboardView.hidden = !showPinboard;
      adminLayout.classList.toggle('config-active', !showEdit);
      [
        [editTab, showEdit],
        [configTab, showConfig],
        [pinboardTab, showPinboard],
      ].forEach(([tab, active]) => {
        tab?.classList.toggle('active', active);
        tab?.setAttribute('aria-selected', String(active));
      });
      if (showEdit && map) setTimeout(() => map.invalidateSize(), 50);
    };
    editTab?.addEventListener('click', () => showAdminView('edit'));
    configTab?.addEventListener('click', () => showAdminView('config'));
    pinboardTab?.addEventListener('click', () => showAdminView('pinboard'));
    document.getElementById('save-map').hidden = role !== 'owner';
    document.getElementById('save-pois').hidden = role !== 'poi';
    document.getElementById('map').hidden = role === 'www';
    const addPoiHint = document.querySelector('[data-i18n="addPoiHint"]');
    if (addPoiHint) addPoiHint.hidden = role === 'www';
    const adminHeading = document.querySelector('.topbar h1');
    if (adminHeading && role === 'poi') adminHeading.textContent = window.AppI18n.t('poiEditorTitle');
    if (adminHeading && role === 'www') adminHeading.textContent = window.AppI18n.t('wwwEditorTitle');
    if (!Array.isArray(data.categories)) data.categories = [];
    data.categories = data.categories
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        ...item,
        id: typeof item.id === 'string' ? item.id : '',
        name: typeof item.name === 'string' ? item.name : '',
        color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#E94F85',
      }));
    if (!Array.isArray(data.pois)) data.pois = [];
    data.pois = data.pois
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        ...item,
        id: typeof item.id === 'string' ? item.id : newId(),
        name: typeof item.name === 'string' ? item.name : '',
        categoryId: typeof item.categoryId === 'string' ? item.categoryId : '',
        icon: typeof item.icon === 'string' ? item.icon : 'fa-location-dot',
      }));
    data.timelines = (Array.isArray(data.timelines) ? data.timelines : [])
      .filter((timeline) => timeline && typeof timeline === 'object' && !Array.isArray(timeline))
      .slice(0, 3)
      .map((timeline) => ({
        id: typeof timeline.id === 'string' && timeline.id ? timeline.id : newId(),
        name: typeof timeline.name === 'string' ? timeline.name : '',
        program: normalizeProgram(timeline.program),
      }));
    data.pois.forEach((p) => {
      p.hasProgram = p.hasProgram === true;
      p.program = normalizeProgram(p.program);
    });
    data.iconMode = data.iconMode === 'colored' ? 'colored' : 'monochrome';
    document.getElementById('title').value = data.title || '';
    document.getElementById('icon-mode').value = data.iconMode;
    document.getElementById('custom-button-label').value = data.customButton?.label || '';
    document.getElementById('custom-button-url').value = data.customButton?.url || '';
    document.getElementById('www-qr-url').value = data.qrUrl || '';
    document.getElementById('impress-url').value = data.impressUrl || '';
    document.getElementById('week-start').value = programDays.includes(data.weekStart)
      ? data.weekStart
      : 'mon';
    setEnabledDayFields();
    document.getElementById('title-link-url').value = data.titleLinkUrl || '';
    document.getElementById('matomo-url').value = data.matomoUrl ?? '';
    document.getElementById('matomo-site-id').value = data.matomoSiteId ?? '';
    document.getElementById('browser-translation-enabled').checked = data.browserTranslationEnabled === true;
    document.getElementById('soundcloud-enabled').checked = data.soundcloudEnabled !== false;
    document.getElementById('soundcloud-playlist').value = data.soundcloudPlaylist || '';
    setThemeFields(data.theme);
    Object.values(themeFields).forEach((input) =>
      input.addEventListener('input', () => {
        data.theme = readThemeFields();
        window.BurnigatorTheme.apply(data.theme);
      })
    );
    document
      .getElementById('theme-reset')
      .addEventListener('click', () => setThemeFields(window.BurnigatorTheme.defaults));
    const overlayGroup = map ? L.layerGroup().addTo(map) : null;
    let bounds;
    function draw() {
      if (!map) return;
      overlayGroup.clearLayers();
      markers.clear();
      if (data.image) {
        bounds = [
          [-data.height, 0],
          [0, data.width],
        ];
        L.imageOverlay(data.image, bounds, { interactive: false }).addTo(overlayGroup);
        map.fitBounds(bounds);
      } else {
        map.setView([0, 0], 0);
      }
      data.pois.forEach((p) => {
        const cat = data.categories.find((c) => c.id === p.categoryId);
        const color = cat?.color || '#E94F85';
        const dot = document.createElement('span');
        dot.className = 'poi-dot';
        dot.style.backgroundColor = color;
        dot.appendChild(makeGlyph(p.icon));
        const icon = L.divIcon({
          className: 'poi-marker',
          html: dot.outerHTML,
          iconSize: [39, 39],
          iconAnchor: [19.5, 19.5],
        });
        const marker = L.marker([-p.y * data.height, p.x * data.width], { icon, draggable: true }).addTo(
          overlayGroup
        );
        marker.on('click', () => selectPoi(p.id));
        marker.on('dragend', () => {
          window.trackAppEvent?.('Admin', 'poi_move');
          const ll = marker.getLatLng();
          p.x = clamp(ll.lng / data.width);
          p.y = clamp(-ll.lat / data.height);
          renderPois();
          if (role === 'poi' || role === 'owner') persistPoiChanges(p);
        });
        markers.set(p.id, marker);
      });
    }
    function makeGlyph(value) {
      const mode = data.iconMode === 'colored' ? ' color-mode' : '';
      if (/^fa-[a-z0-9-]{2,60}$/.test(value || '')) {
        const glyph = document.createElement('i');
        glyph.className = 'poi-glyph fa-solid ' + value + mode;
        return glyph;
      }
      const glyph = document.createElement('span');
      glyph.className = 'poi-glyph' + mode;
      glyph.textContent = value || '•';
      return glyph;
    }
    function renderCategories() {
      const host = document.getElementById('category-editor');
      host.replaceChildren();
      data.categories.forEach((c) => {
        const row = document.createElement('div');
        row.className = 'category-row';
        const color = document.createElement('input');
        color.type = 'color';
        color.value = c.color;
        color.onchange = () => {
          c.color = color.value;
          draw();
        };
        const name = document.createElement('input');
        name.maxLength = 60;
        name.value = c.name;
        name.oninput = () => (c.name = name.value);
        const del = document.createElement('button');
        del.className = 'button button-primary button-danger danger';
        del.textContent = window.AppI18n.t('categoryDelete');
        del.onclick = () => {
          window.trackAppEvent?.('Admin', 'category_delete');
          data.categories = data.categories.filter((x) => x.id !== c.id);
          data.pois.forEach((p) => {
            if (p.categoryId === c.id) p.categoryId = '';
          });
          renderCategories();
          renderPois();
          draw();
        };
        row.append(color, name, del);
        host.appendChild(row);
      });
    }
    let collapsedMode = true,
      selectedPoiId = null;
    const openPoiIds = new Set();
    function renderPois() {
      const host = document.getElementById('poi-editor');
      host.replaceChildren();
      const toolbar = document.createElement('div');
      toolbar.className = 'places-toolbar';
      toolbar.hidden = role === 'www';
      const collapse = document.createElement('button');
      collapse.type = 'button';
      collapse.className = 'button button-secondary subtle';
      collapse.textContent = window.AppI18n.t('collapsePlaces');
      collapse.onclick = () => {
        collapsedMode = true;
        openPoiIds.clear();
        renderPois();
      };
      const expand = document.createElement('button');
      expand.type = 'button';
      expand.className = 'button button-secondary subtle';
      expand.textContent = window.AppI18n.t('expandPlaces');
      expand.onclick = () => {
        collapsedMode = false;
        data.pois.forEach((p) => openPoiIds.add(p.id));
        renderPois();
      };
      toolbar.append(collapse, expand);
      host.appendChild(toolbar);
      const groups = new Map();
      data.categories
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, window.AppI18n.lang()))
        .forEach((c) => groups.set(c.id, { category: c, pois: [] }));
      data.pois.forEach((p) => {
        const key = groups.has(p.categoryId) ? p.categoryId : '';
        if (!groups.has(key)) groups.set(key, { category: null, pois: [] });
        groups.get(key).pois.push(p);
      });
      const ordered = [...groups.values()]
        .filter((g) => g.pois.length && g.category)
        .concat([...groups.values()].filter((g) => g.pois.length && !g.category));
      if (!ordered.length) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.textContent = window.AppI18n.t('noPlaces');
        host.appendChild(empty);
        return;
      }
      ordered.forEach((group) => {
        const section = document.createElement('section');
        section.className = 'poi-group';
        const heading = document.createElement('h3');
        heading.textContent = group.category ? group.category.name : window.AppI18n.t('uncategorized');
        const count = document.createElement('span');
        count.className = 'poi-count';
        count.textContent = String(group.pois.length);
        heading.appendChild(count);
        section.appendChild(heading);
        group.pois.forEach((p) => {
          const cat = group.category;
          const color = cat?.color || '#E94F85';
          const card = document.createElement('details');
          card.className = 'poi-card';
          card.dataset.poiId = p.id;
          if (selectedPoiId === p.id) card.classList.add('poi-selected');
          card.open = role === 'www' ? openPoiIds.has(p.id) : collapsedMode ? openPoiIds.has(p.id) : true;
          card.addEventListener('toggle', () => {
            if (card.open) openPoiIds.add(p.id);
            else openPoiIds.delete(p.id);
          });
          const summary = document.createElement('summary');
          summary.className = 'poi-summary button-light';
          const badge = document.createElement('span');
          badge.className = 'poi-summary-icon';
          badge.style.backgroundColor = color;
          badge.appendChild(makeGlyph(p.icon));
          summary.append(badge);
          const summaryName = document.createElement('span');
          summaryName.className = 'poi-summary-name';
          summaryName.textContent = p.name || window.AppI18n.t('locationName');
          summary.appendChild(summaryName);
          const fields = document.createElement('div');
          fields.className = 'poi-fields';
          const name = document.createElement('input');
          name.placeholder = window.AppI18n.t('name');
          name.maxLength = 100;
          name.value = p.name;
          name.oninput = () => {
            p.name = name.value;
            summaryName.textContent = name.value || window.AppI18n.t('locationName');
          };
          const icon = document.createElement('input');
          icon.placeholder = window.AppI18n.t('customIcon');
          icon.maxLength = 70;
          icon.value = p.icon || 'fa-location-dot';
          icon.setAttribute('aria-label', window.AppI18n.t('customIcon'));
          icon.oninput = () => {
            p.icon = icon.value;
            badge.replaceChildren(makeGlyph(p.icon));
            draw();
          };
          const picker = document.createElement('details');
          picker.className = 'icon-picker';
          const pickerSummary = document.createElement('summary');
          pickerSummary.className = 'button-outlined';
          pickerSummary.textContent = window.AppI18n.t('iconSearchSummary');
          const search = document.createElement('input');
          search.type = 'search';
          search.placeholder = window.AppI18n.t('iconSearchPlaceholder');
          search.setAttribute('aria-label', window.AppI18n.t('iconSearchSummary'));
          const options = document.createElement('div');
          options.className = 'icon-options';
          function showOptions(query = '') {
            options.replaceChildren();
            const q = query.trim().toLocaleLowerCase(window.AppI18n.lang());
            const matches = ICON_OPTIONS.filter(
              ([symbol, label]) =>
                !q || (symbol + ' ' + label).toLocaleLowerCase(window.AppI18n.lang()).includes(q)
            );
            if (!matches.length) {
              const empty = document.createElement('small');
              empty.textContent = window.AppI18n.t('iconSearchEmpty');
              options.appendChild(empty);
              return;
            }
            matches.forEach(([symbol, label]) => {
              const choice = document.createElement('button');
              choice.type = 'button';
              choice.className = 'icon-choice button-outlined';
              const preview = document.createElement('i');
              preview.className = 'fa-solid ' + symbol;
              choice.appendChild(preview);
              const currentLabel =
                window.AppI18n.lang() === 'en' ? symbol.replace(/^fa-/, '').replaceAll('-', ' ') : label;
              choice.title = currentLabel;
              choice.setAttribute('aria-label', currentLabel + ' (' + symbol + ')');
              choice.onclick = () => {
                p.icon = symbol;
                icon.value = symbol;
                badge.replaceChildren(makeGlyph(p.icon));
                draw();
              };
              options.appendChild(choice);
            });
          }
          search.oninput = () => showOptions(search.value);
          showOptions();
          picker.append(pickerSummary, search, options);
          const desc = document.createElement('textarea');
          desc.placeholder = window.AppI18n.t('description');
          desc.maxLength = 1000;
          desc.value = p.description || '';
          desc.oninput = () => (p.description = desc.value);
          const sel = document.createElement('select');
          const none = document.createElement('option');
          none.value = '';
          none.textContent = window.AppI18n.t('categoryNone');
          sel.appendChild(none);
          data.categories.forEach((c) => {
            const o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.name;
            sel.append(o);
          });
          sel.value = p.categoryId || '';
          sel.onchange = () => {
            window.trackAppEvent?.('Admin', 'poi_category_change');
            p.categoryId = sel.value;
            draw();
          };
          const programToggle = document.createElement('label');
          programToggle.className = 'program-toggle';
          const hasProgram = document.createElement('input');
          hasProgram.type = 'checkbox';
          hasProgram.checked = p.hasProgram;
          const programLabel = document.createElement('span');
          programLabel.textContent = window.AppI18n.t('hasProgram');
          programLabel.dataset.i18n = 'hasProgram';
          programToggle.append(hasProgram, programLabel);
          hasProgram.onchange = () => {
            window.trackAppEvent?.(
              'Admin',
              'poi_program_toggle',
              hasProgram.checked ? 'enabled' : 'disabled'
            );
            p.hasProgram = hasProgram.checked;
            openPoiIds.add(p.id);
            renderPois();
          };
          const programEditor = buildProgramEditor(p);
          const savePoi = document.createElement('button');
          savePoi.type = 'button';
          savePoi.className = 'button button-primary poi-save';
          savePoi.textContent = window.AppI18n.t('save');
          savePoi.onclick = () => {
            window.trackAppEvent?.('Admin', role === 'www' ? 'program_save' : 'poi_save');
            if (role === 'poi' || role === 'owner') persistPoiChanges(p);
            else if (role === 'www') persistProgramChanges(p);
            else persistMap();
          };
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'button button-primary button-danger danger';
          remove.textContent = window.AppI18n.t('deletePlace');
          remove.onclick = async () => {
            if (role === 'poi' && poiHasEvents(p)) {
              say(window.AppI18n.t('poiDeleteHasEvents'), true);
              return;
            }
            if (!confirm(window.AppI18n.t('confirmDeletePlace'))) return;
            window.trackAppEvent?.('Admin', 'poi_delete');
            if (role === 'poi') {
              await deletePoiRemote(p.id);
              return;
            }
            data.pois = data.pois.filter((x) => x.id !== p.id);
            openPoiIds.delete(p.id);
            renderPois();
            draw();
          };
          const position = document.createElement('small');
          position.textContent =
            window.AppI18n.t('position') + ': ' + Math.round(p.x * 100) + '%, ' + Math.round(p.y * 100) + '%';
          if (role !== 'www') fields.append(name, icon, picker, desc, sel);
          if (role !== 'poi') fields.appendChild(programToggle);
          if (role !== 'poi' && p.hasProgram) {
            if (role === 'www') programEditor.open = true;
            fields.appendChild(programEditor);
          }
          if (role !== 'www') fields.appendChild(position);
          if (role === 'www') fields.appendChild(savePoi);
          else {
            const actions = document.createElement('div');
            actions.className = 'poi-actions';
            actions.append(savePoi, remove);
            fields.appendChild(actions);
          }
          card.append(summary, fields);
          section.appendChild(card);
        });
        host.appendChild(section);
      });
    }
    function normalizeProgram(program) {
      const out = {};
      const allowed = eventCategories.map((x) => x[0]);
      programDays.forEach((day) => {
        const entries = Array.isArray(program?.[day]) ? program[day] : [];
        out[day] = entries
          .filter((e) => e && typeof e === 'object')
          .slice(0, 100)
          .map((e) => ({
            id: typeof e.id === 'string' && /^[a-f0-9-]{1,40}$/.test(e.id) ? e.id : newId(),
            hasOwner: e.hasOwner === true,
            start: /^([01]\d|2[0-3]):[0-5]\d$/.test(e.start || e.time || '') ? e.start || e.time : '12:00',
            end: /^([01]\d|2[0-3]):[0-5]\d$/.test(e.end || '') ? e.end : '',
            text: typeof e.text === 'string' ? e.text.slice(0, 200) : '',
            host: typeof e.host === 'string' ? e.host.slice(0, 200) : '',
            description: typeof e.description === 'string' ? e.description.slice(0, 1000) : '',
            linkUrl: typeof e.linkUrl === 'string' ? e.linkUrl.slice(0, 2048) : '',
            linkText: typeof e.linkText === 'string' ? e.linkText.slice(0, 120) : '',
            categories: Array.isArray(e.categories)
              ? [...new Set(e.categories.filter((x) => allowed.includes(x)))]
              : [],
          }));
      });
      return out;
    }
    function buildEventOwnerFields(event, redraw) {
      const box = document.createElement('div');
      box.className = 'program-owner-fields';
      const label = document.createElement('label');
      const labelText = document.createElement('span');
      labelText.textContent = window.AppI18n.t('eventOwnerCode');
      labelText.dataset.i18n = 'eventOwnerCode';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 100;
      input.autocomplete = 'off';
      input.placeholder = window.AppI18n.t(
        event.hasOwner ? 'eventOwnerCodeSet' : 'eventOwnerCodePlaceholder'
      );
      input.oninput = () => {
        event.ownerCode = input.value.trim();
        if (event.ownerCode) event.ownerClear = false;
      };
      label.append(labelText, input);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = window.AppI18n.t('eventOwnerHint');
      hint.dataset.i18n = 'eventOwnerHint';
      box.append(label, hint);
      if (event.hasOwner) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button button-outlined';
        remove.textContent = window.AppI18n.t('eventOwnerRemove');
        remove.onclick = () => {
          window.trackAppEvent?.('Admin', 'event_owner_remove');
          event.ownerClear = true;
          event.hasOwner = false;
          delete event.ownerCode;
          redraw();
        };
        box.appendChild(remove);
      }
      return box;
    }
    function buildProgramEditor(p) {
      const box = document.createElement('details');
      box.className = 'program-editor';
      const summary = document.createElement('summary');
      summary.textContent = window.AppI18n.t('programHeading');
      summary.dataset.i18n = 'programHeading';
      summary.classList.add('button-secondary');
      box.appendChild(summary);
      orderedProgramDays().forEach((day) => {
        const group = document.createElement('details');
        group.className = 'program-day';
        group.open = p.program[day].length > 0;
        const heading = document.createElement('summary');
        heading.className = 'program-day-summary';
        const dayName = document.createElement('span');
        dayName.textContent = window.AppI18n.t('day' + day[0].toUpperCase() + day.slice(1));
        dayName.dataset.i18n = 'day' + day[0].toUpperCase() + day.slice(1);
        const dayCount = document.createElement('span');
        dayCount.className = 'program-day-count';
        heading.append(dayName, dayCount);
        group.appendChild(heading);
        const entries = document.createElement('div');
        entries.className = 'program-day-entries';
        function drawEntries() {
          entries.replaceChildren();
          dayCount.textContent = p.program[day].length ? String(p.program[day].length) : '';
          dayCount.hidden = p.program[day].length === 0;
          p.program[day].forEach((event, index) => {
            const eventCard = document.createElement('details');
            eventCard.className = 'program-event-card';
            eventCard.open = event.isNew === true || event.expanded === true;
            eventCard.addEventListener('toggle', () => (event.expanded = eventCard.open));
            const cardSummary = document.createElement('summary');
            cardSummary.className = 'program-event-summary';
            const summaryTime = document.createElement('span');
            summaryTime.className = 'program-event-summary-time';
            const summaryTitle = document.createElement('span');
            summaryTitle.className = 'program-event-summary-title';
            cardSummary.append(summaryTime, summaryTitle);
            const syncSummary = () => {
              const overnight = !!(
                event.start &&
                event.end &&
                event.end < event.start &&
                event.end !== '00:00'
              );
              summaryTime.textContent = event.start
                ? event.start + (event.end ? '–' + event.end : '') + (overnight ? ' +1' : '')
                : '–';
              note.hidden = !overnight;
              const title = String(event.text || '').trim();
              summaryTitle.textContent = title || window.AppI18n.t('eventHintTitle');
              cardSummary.classList.toggle('is-incomplete', !title || !event.start);
            };
            const field = (key, control, className = '') => {
              const label = document.createElement('label');
              label.className = ('program-field ' + className).trim();
              const caption = document.createElement('span');
              caption.textContent = window.AppI18n.t(key);
              caption.dataset.i18n = key;
              label.append(caption, control);
              return label;
            };
            const section = (key) => {
              const wrap = document.createElement('div');
              wrap.className = 'program-event-section';
              const heading = document.createElement('p');
              heading.className = 'program-event-section-title';
              heading.textContent = window.AppI18n.t(key);
              heading.dataset.i18n = key;
              wrap.appendChild(heading);
              return wrap;
            };
            const row = document.createElement('div');
            row.className = 'program-entry';
            const start = document.createElement('input');
            start.type = 'time';
            start.value = event.start;
            start.setAttribute('aria-label', window.AppI18n.t('eventStart'));
            const end = document.createElement('input');
            end.type = 'time';
            end.value = event.end;
            end.setAttribute('aria-label', window.AppI18n.t('eventEnd'));
            end.onchange = () => {
              event.end = end.value;
              syncSummary();
            };
            end.oninput = end.onchange;
            const text = document.createElement('input');
            text.type = 'text';
            text.maxLength = 200;
            text.placeholder = window.AppI18n.t('eventTitle');
            text.value = event.text;
            const hint = document.createElement('p');
            hint.className = 'program-entry-hint';
            hint.setAttribute('role', 'status');
            const note = document.createElement('p');
            note.className = 'program-entry-note';
            note.setAttribute('role', 'status');
            note.textContent = window.AppI18n.t('eventOvernight');
            note.dataset.i18n = 'eventOvernight';
            note.hidden = true;
            const syncHint = () => {
              const missing = [];
              const titleMissing = !String(event.text || '').trim();
              const startMissing = !event.start;
              text.setAttribute('aria-invalid', String(titleMissing));
              start.setAttribute('aria-invalid', String(startMissing));
              if (titleMissing) missing.push(window.AppI18n.t('eventHintTitle'));
              if (startMissing) missing.push(window.AppI18n.t('eventHintStart'));
              hint.textContent = missing.join(' ');
              hint.hidden = missing.length === 0;
              syncSummary();
            };
            text.oninput = () => {
              event.text = text.value;
              syncHint();
            };
            start.onchange = () => {
              event.start = start.value;
              syncHint();
            };
            start.oninput = start.onchange;
            syncHint();
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'button button-primary button-danger danger program-event-delete';
            del.textContent = window.AppI18n.t('deleteEvent');
            del.dataset.i18n = 'deleteEvent';
            del.onclick = () => {
              if (!confirm(window.AppI18n.t('confirmDeleteEvent'))) return;
              window.trackAppEvent?.('Admin', 'event_delete', day);
              p.program[day].splice(index, 1);
              drawEntries();
            };
            row.append(
              field('eventTitle', text, 'program-field-title'),
              field('eventStart', start),
              field('eventEnd', end)
            );
            const host = document.createElement('input');
            host.type = 'text';
            host.className = 'program-host';
            host.maxLength = 200;
            host.placeholder = window.AppI18n.t('eventHost');
            host.value = event.host || '';
            host.setAttribute('aria-label', window.AppI18n.t('eventHost'));
            host.oninput = () => (event.host = host.value);
            const description = document.createElement('textarea');
            description.className = 'program-description';
            description.maxLength = 1000;
            description.placeholder = window.AppI18n.t('eventDescription');
            description.value = event.description || '';
            description.setAttribute('aria-label', window.AppI18n.t('eventDescription'));
            description.oninput = () => (event.description = description.value);
            const linkFields = document.createElement('div');
            linkFields.className = 'program-link-fields';
            const linkUrl = document.createElement('input');
            linkUrl.type = 'url';
            linkUrl.maxLength = 2048;
            linkUrl.placeholder = window.AppI18n.t('eventLinkUrl');
            linkUrl.value = event.linkUrl || '';
            linkUrl.setAttribute('aria-label', window.AppI18n.t('eventLinkUrl'));
            linkUrl.oninput = () => (event.linkUrl = linkUrl.value);
            const linkText = document.createElement('input');
            linkText.type = 'text';
            linkText.maxLength = 120;
            linkText.placeholder = window.AppI18n.t('eventLinkText');
            linkText.value = event.linkText || '';
            linkText.setAttribute('aria-label', window.AppI18n.t('eventLinkText'));
            linkText.oninput = () => (event.linkText = linkText.value);
            linkFields.append(field('eventLinkUrl', linkUrl), field('eventLinkText', linkText));
            const picker = document.createElement('details');
            picker.className = 'event-category-picker';
            const pickerSummary = document.createElement('summary');
            pickerSummary.className = 'button-outlined';
            pickerSummary.textContent = window.AppI18n.t('eventCategories');
            pickerSummary.dataset.i18n = 'eventCategories';
            const options = document.createElement('div');
            options.className = 'event-category-options';
            eventCategories.forEach(([key, iconName]) => {
              const option = document.createElement('label');
              option.className = 'event-category-option chip-button';
              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
              checkbox.checked = event.categories.includes(key);
              option.classList.toggle('active', checkbox.checked);
              const icon = document.createElement('i');
              icon.className = 'fa-solid ' + iconName;
              const label = document.createElement('span');
              label.textContent = window.AppI18n.t('eventCategory' + key[0].toUpperCase() + key.slice(1));
              label.dataset.i18n = 'eventCategory' + key[0].toUpperCase() + key.slice(1);
              checkbox.onchange = () => {
                option.classList.toggle('active', checkbox.checked);
                window.trackAppEvent?.(
                  'Admin',
                  'event_category_toggle',
                  key + (checkbox.checked ? '_enabled' : '_disabled')
                );
                event.categories = checkbox.checked
                  ? [...new Set([...event.categories, key])]
                  : event.categories.filter((x) => x !== key);
              };
              option.append(checkbox, icon, label);
              options.appendChild(option);
            });
            picker.append(pickerSummary, options);
            const detailsSection = section('eventSectionDetails');
            detailsSection.append(field('eventHost', host), field('eventDescription', description));
            const linkSection = section('eventSectionLink');
            linkSection.appendChild(linkFields);
            const categorySection = section('eventSectionCategories');
            categorySection.appendChild(picker);
            const actions = document.createElement('div');
            actions.className = 'program-event-actions';
            if (role === 'www') {
              const saveEvent = document.createElement('button');
              saveEvent.type = 'button';
              saveEvent.className = 'button button-primary poi-save program-event-save';
              saveEvent.textContent = window.AppI18n.t('save');
              saveEvent.onclick = () => saveProgramEvent(p);
              actions.appendChild(saveEvent);
            } else if (event.isNew) {
              const saveEvent = document.createElement('button');
              saveEvent.type = 'button';
              saveEvent.className = 'button button-primary program-event-save';
              saveEvent.textContent = window.AppI18n.t('saveEvent');
              saveEvent.dataset.i18n = 'saveEvent';
              saveEvent.onclick = () =>
                document.getElementById(role === 'owner' ? 'save-map' : 'save-pois')?.click();
              actions.appendChild(saveEvent);
            }
            actions.appendChild(del);
            eventCard.append(cardSummary, row, hint, note, detailsSection, linkSection, categorySection);
            if (role === 'owner') eventCard.appendChild(buildEventOwnerFields(event, drawEntries));
            eventCard.appendChild(actions);
            entries.appendChild(eventCard);
          });
        }
        drawEntries();
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'button button-secondary subtle program-add';
        add.textContent = window.AppI18n.t('addEvent');
        add.dataset.i18n = 'addEvent';
        add.onclick = () => {
          window.trackAppEvent?.('Admin', 'event_add', day);
          group.open = true;
          p.program[day].push({
            id: newId(),
            isNew: true,
            start: '12:00',
            end: '13:00',
            text: '',
            host: '',
            description: '',
            linkUrl: '',
            linkText: '',
            categories: [],
          });
          drawEntries();
        };
        group.append(entries, add);
        box.appendChild(group);
      });
      return box;
    }
    function renderTimelines() {
      const host = document.getElementById('timeline-editor');
      if (!host) return;
      host.replaceChildren();
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'button button-secondary subtle';
      add.textContent = window.AppI18n.t('addIndependentTimeline');
      add.disabled = data.timelines.length >= 3;
      add.onclick = () => {
        window.trackAppEvent?.('Admin', 'independent_timeline_add');
        data.timelines.push({ id: newId(), name: '', program: normalizeProgram({}) });
        renderTimelines();
        host
          .querySelectorAll('.timeline-name-input')
          .item(data.timelines.length - 1)
          ?.focus();
      };
      host.appendChild(add);
      data.timelines.forEach((timeline, index) => {
        const card = document.createElement('section');
        card.className = 'independent-timeline-card';
        const heading = document.createElement('h3');
        heading.textContent = window.AppI18n.t('independentTimeline') + ' ' + (index + 1);
        const name = document.createElement('input');
        name.type = 'text';
        name.maxLength = 60;
        name.required = true;
        name.className = 'timeline-name-input';
        name.placeholder = window.AppI18n.t('timelineName');
        name.value = timeline.name || '';
        name.setAttribute('aria-label', name.placeholder);
        name.oninput = () => (timeline.name = name.value);
        const actions = document.createElement('div');
        actions.className = 'poi-actions independent-timeline-actions';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'button button-primary poi-save';
        save.textContent = window.AppI18n.t('save');
        save.onclick = () => saveTimelines(timeline.id);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button button-primary button-danger danger';
        remove.textContent = window.AppI18n.t('deleteTimeline');
        remove.onclick = async () => {
          if (!confirm(window.AppI18n.t('confirmDeleteTimeline'))) return;
          window.trackAppEvent?.('Admin', 'independent_timeline_delete', timeline.name || timeline.id);
          const previous = data.timelines;
          data.timelines = data.timelines.filter((item) => item.id !== timeline.id);
          renderTimelines();
          if (!(await saveTimelines())) {
            data.timelines = previous;
            renderTimelines();
          }
        };
        actions.append(save, remove);
        const top = document.createElement('div');
        top.className = 'independent-timeline-heading';
        top.appendChild(heading);
        card.append(top, name, buildProgramEditor(timeline), actions);
        host.appendChild(card);
      });
    }
    async function saveTimelines(timelineId) {
      if (data.timelines.length > 3) {
        say(window.AppI18n.t('timelineLimit'), true);
        return false;
      }
      const timeline = data.timelines.find((item) => item.id === timelineId);
      if (timeline && !String(timeline.name || '').trim()) {
        say(window.AppI18n.t('timelineNameRequired'), true);
        document.querySelector('.independent-timeline-card .timeline-name-input')?.focus();
        return false;
      }
      if (data.timelines.some((item) => !String(item.name || '').trim())) {
        say(window.AppI18n.t('timelineNameRequired'), true);
        document.querySelector('.independent-timeline-card .timeline-name-input')?.focus();
        return false;
      }
      if (hasIncompleteEvent(data.timelines)) return false;
      if (hasInvalidEventTime(data.timelines)) {
        say(window.AppI18n.t('invalidEventTime'), true);
        return false;
      }
      const events = data.timelines.flatMap((item) => Object.values(item.program || {}).flat());
      if (events.some((event) => !String(event.text || '').trim())) {
        say(window.AppI18n.t('timelineEventTitleRequired'), true);
        document
          .querySelector('.independent-timeline-card .program-event-card .program-entry input[type="text"]')
          ?.focus();
        return false;
      }
      try {
        const response = await fetch('api.php?action=save-timelines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
          body: JSON.stringify({ timelines: data.timelines, expectedUpdatedAt: data.updatedAt || '' }),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || window.AppI18n.t('failedSave'));
        data.updatedAt = result.map.updatedAt;
        data.timelines = (result.map.timelines || []).map((item) => ({
          ...item,
          program: normalizeProgram(item.program),
        }));
        renderTimelines();
        say(window.AppI18n.t('timelinesSaved'));
        refreshHistory();
        window.dispatchEvent(new Event('burnigator-map-saved'));
        return true;
      } catch (error) {
        say(userError(error.message), true);
        return false;
      }
    }
    function selectPoi(id) {
      const p = data.pois.find((x) => x.id === id);
      if (!p) return;
      selectedPoiId = id;
      openPoiIds.add(id);
      renderPois();
      const card = document.querySelector('#poi-editor [data-poi-id="' + CSS.escape(id) + '"]');
      if (card) {
        card.open = true;
        requestAnimationFrame(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.querySelector('summary')?.focus({ preventScroll: true });
        });
      }
    }
    function clamp(v) {
      return Math.min(1, Math.max(0, v));
    }
    function newId() {
      return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random())
        .replace(/[^a-f0-9-]/gi, '')
        .slice(0, 36);
    }
    document.getElementById('add-category').onclick = () => {
      const name = document.getElementById('new-category').value.trim();
      if (!name) return;
      window.trackAppEvent?.('Admin', 'category_add');
      data.categories.push({ id: newId(), name, color: document.getElementById('new-color').value });
      document.getElementById('new-category').value = '';
      renderCategories();
      renderPois();
      draw();
    };
    document.getElementById('icon-mode').onchange = (event) => {
      data.iconMode = event.target.value;
      draw();
    };
    document.getElementById('upload-image').onclick = async () => {
      const f = document.getElementById('image-file').files[0];
      if (!f) {
        say(window.AppI18n.t('selectImage'), true);
        return;
      }
      window.trackAppEvent?.('Admin', 'background_upload');
      const form = new FormData();
      form.append('image', f);
      try {
        const r = await fetch('api.php?action=upload', {
          method: 'POST',
          headers: { 'X-CSRF-Token': window.MAP_CSRF },
          body: form,
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error || window.AppI18n.t('uploadFailed'));
        data = {
          ...j.map,
          title: data.title,
          categories: data.categories,
          pois: data.pois,
          iconMode: data.iconMode,
        };
        draw();
        say(window.AppI18n.t('uploadSuccess'));
        window.dispatchEvent(new Event('burnigator-map-saved'));
      } catch (e) {
        say(userError(e.message), true);
      }
    };
    function refreshBrandingPreview(kind) {
      const path = data[kind] || '',
        img = document.getElementById(kind === 'logo' ? 'logo-preview' : 'favicon-preview');
      if (/^uploads\/(?:logo|favicon)-[a-f0-9]{24}\.png$/.test(path)) {
        img.src = path;
        img.hidden = false;
      } else {
        img.removeAttribute('src');
        img.hidden = true;
      }
    }
    refreshBrandingPreview('logo');
    refreshBrandingPreview('favicon');
    async function uploadBranding(kind) {
      const fileInput = document.getElementById(kind === 'logo' ? 'logo-file' : 'favicon-file'),
        file = fileInput.files[0];
      if (!file) {
        say(window.AppI18n.t('brandingUploadError'), true);
        return;
      }
      window.trackAppEvent?.('Admin', 'branding_upload', kind);
      const form = new FormData();
      form.append('image', file);
      try {
        const r = await fetch('api.php?action=upload-branding&kind=' + encodeURIComponent(kind), {
          method: 'POST',
          headers: { 'X-CSRF-Token': window.MAP_CSRF },
          body: form,
        });
        const j = await r.json();
        if (!r.ok) throw Error('upload');
        data = j.map;
        refreshBrandingPreview(kind);
        fileInput.value = '';
        say(window.AppI18n.t('brandingUploadSuccess'));
        window.dispatchEvent(new Event('burnigator-map-saved'));
      } catch (_) {
        say(window.AppI18n.t('brandingUploadError'), true);
      }
    }
    document.getElementById('upload-logo').onclick = () => uploadBranding('logo');
    document.getElementById('upload-favicon').onclick = () => uploadBranding('favicon');
    function hasIncompleteEvent(items) {
      const incomplete = (items || []).some((p) =>
        Object.entries(p.program || {}).some(
          ([day, events]) =>
            enabledProgramDays().includes(day) &&
            Array.isArray(events) &&
            events.some((e) => e && (!String(e.text || '').trim() || !e.start))
        )
      );
      if (!incomplete) return false;
      say(window.AppI18n.t('eventIncomplete'), true);
      const field = document.querySelector('.program-event-card [aria-invalid="true"]');
      for (let node = field?.closest('details'); node; node = node.parentElement?.closest('details'))
        node.open = true;
      field?.scrollIntoView?.({ block: 'center' });
      field?.focus();
      return true;
    }
    function hasInvalidEventTime(pois) {
      return (pois || []).some((p) =>
        Object.values(p.program || {}).some(
          (events) => Array.isArray(events) && events.some((e) => e && e.end && e.start && e.end === e.start)
        )
      );
    }
    async function persistMap(successMessage = window.AppI18n.t('saveSuccess')) {
      if (data.timelines.length > 3) {
        say(window.AppI18n.t('timelineLimit'), true);
        return;
      }
      if (data.timelines.some((item) => !String(item.name || '').trim())) {
        say(window.AppI18n.t('timelineNameRequired'), true);
        return;
      }
      if (hasIncompleteEvent([...data.pois, ...data.timelines])) return;
      if (hasInvalidEventTime([...data.pois, ...data.timelines])) {
        say(window.AppI18n.t('invalidEventTime'), true);
        return;
      }
      data.title = document.getElementById('title').value;
      data.customButton = {
        label: document.getElementById('custom-button-label').value.trim(),
        url: document.getElementById('custom-button-url').value.trim(),
      };
      data.qrUrl = document.getElementById('www-qr-url').value.trim();
      data.impressUrl = document.getElementById('impress-url').value.trim();
      data.weekStart = document.getElementById('week-start').value;
      data.enabledDays = [...document.querySelectorAll('.enabled-day')]
        .filter((box) => box.checked)
        .map((box) => box.value);
      if (!data.enabledDays.length) {
        say(window.AppI18n.t('enabledDaysRequired'), true);
        return;
      }
      data.titleLinkUrl = document.getElementById('title-link-url').value.trim();
      data.matomoUrl = document.getElementById('matomo-url').value.trim();
      data.matomoSiteId = document.getElementById('matomo-site-id').value.trim();
      data.browserTranslationEnabled = document.getElementById('browser-translation-enabled').checked;
      data.soundcloudEnabled = document.getElementById('soundcloud-enabled').checked;
      data.soundcloudPlaylist = document.getElementById('soundcloud-playlist').value.trim();
      data.theme = readThemeFields();
      window.BurnigatorTheme.apply(data.theme);
      if (data.matomoUrl) {
        try {
          const matomoUrl = new URL(data.matomoUrl);
          if (
            !['http:', 'https:'].includes(matomoUrl.protocol) ||
            matomoUrl.username ||
            matomoUrl.password ||
            matomoUrl.search ||
            matomoUrl.hash
          )
            throw new Error('invalid');
        } catch (_) {
          say(window.AppI18n.t('matomoInvalidUrl'), true);
          return;
        }
        if (!/^[1-9][0-9]{0,8}$/.test(data.matomoSiteId)) {
          say(window.AppI18n.t('matomoInvalidSiteId'), true);
          return;
        }
      }
      if (data.soundcloudPlaylist) {
        try {
          const playlist = new URL(data.soundcloudPlaylist);
          if (
            playlist.protocol !== 'https:' ||
            !['soundcloud.com', 'www.soundcloud.com'].includes(playlist.hostname.toLowerCase()) ||
            !/^\/[^/]+\/sets\/[^/]+\/?$/.test(playlist.pathname)
          )
            throw new Error('invalid');
        } catch (_) {
          say(window.AppI18n.t('soundcloudPlaylistInvalid'), true);
          return;
        }
      }
      if (data.qrUrl) {
        try {
          const qrUrl = new URL(data.qrUrl);
          if (!['http:', 'https:'].includes(qrUrl.protocol)) throw new Error('invalid');
        } catch (_) {
          say(window.AppI18n.t('qrUrlInvalid'), true);
          return;
        }
      }
      if (data.titleLinkUrl) {
        try {
          const titleLinkUrl = new URL(data.titleLinkUrl);
          if (!['http:', 'https:'].includes(titleLinkUrl.protocol)) throw new Error('invalid');
        } catch (_) {
          say(window.AppI18n.t('titleLinkUrlInvalid'), true);
          return;
        }
      }
      if (data.impressUrl) {
        try {
          const impressUrl = new URL(data.impressUrl);
          if (!['http:', 'https:'].includes(impressUrl.protocol)) throw new Error('invalid');
        } catch (_) {
          say(window.AppI18n.t('impressUrlInvalid'), true);
          return;
        }
      }
      try {
        const r = await fetch('api.php?action=save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
          body: JSON.stringify({ ...data, expectedUpdatedAt: data.updatedAt || '' }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error || window.AppI18n.t('failedSave'));
        data = j.map;
        data.theme = window.BurnigatorTheme.apply(data.theme);
        setThemeFields(data.theme);
        renderCategories();
        renderPois();
        renderTimelines();
        draw();
        say(successMessage);
        refreshHistory();
        window.dispatchEvent(new Event('burnigator-map-saved'));
      } catch (e) {
        say(userError(e.message), true);
      }
    }
    async function persistRolePayload(action, payload) {
      if (
        hasIncompleteEvent(
          [data.pois.find((p) => p.id === (payload.poi?.id || payload.program?.id))].filter(Boolean)
        )
      )
        return;
      if (
        hasInvalidEventTime(
          [data.pois.find((p) => p.id === (payload.poi?.id || payload.program?.id))].filter(Boolean)
        )
      ) {
        say(window.AppI18n.t('invalidEventTime'), true);
        return;
      }
      try {
        const r = await fetch('api.php?action=' + action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
          body: JSON.stringify({ ...payload, expectedUpdatedAt: data.updatedAt || '' }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error || window.AppI18n.t('failedSave'));
        data = j.map;
        data.theme = window.BurnigatorTheme.apply(data.theme);
        renderPois();
        draw();
        say(window.AppI18n.t('saveSuccess'));
        refreshHistory();
        window.dispatchEvent(new Event('burnigator-map-saved'));
      } catch (e) {
        say(userError(e.message), true);
      }
    }
    function persistPoiChanges(p) {
      return persistRolePayload('save-poi', { poi: p });
    }
    function persistProgramChanges(p) {
      return persistRolePayload('save-program', {
        program: { id: p.id, name: p.name, hasProgram: p.hasProgram, program: p.program },
      });
    }
    async function saveProgramEvent(p) {
      if (roleSaveInProgress) return;
      if (hasIncompleteEvent([p])) return;
      if (hasInvalidEventTime([p])) {
        say(window.AppI18n.t('invalidEventTime'), true);
        return;
      }
      if (
        p.hasProgram === true &&
        Object.values(p.program || {}).some(
          (events) => Array.isArray(events) && events.some((event) => !String(event?.text || '').trim())
        )
      ) {
        say(window.AppI18n.t('timelineEventTitleRequired'), true);
        return;
      }
      roleSaveInProgress = true;
      document
        .querySelectorAll('.admin-layout[data-role="www"] .poi-save')
        .forEach((button) => (button.disabled = true));
      window.trackAppEvent?.('Admin', 'program_event_save', p.name || p.id);
      try {
        if (p.hasProgram === true) {
          if (p.unsaved) await persistPoiChanges(p);
          else await persistProgramChanges(p);
        } else await saveTimelines(p.id);
      } finally {
        roleSaveInProgress = false;
        document
          .querySelectorAll('.admin-layout[data-role="www"] .poi-save')
          .forEach((button) => (button.disabled = false));
      }
    }
    function poiHasEvents(p) {
      return Object.values(p.program || {}).some((events) => Array.isArray(events) && events.length > 0);
    }
    async function deletePoiRemote(id) {
      try {
        const r = await fetch('api.php?action=delete-poi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
          body: JSON.stringify({
            id,
            name: data.pois.find((p) => p.id === id)?.name || id,
            expectedUpdatedAt: data.updatedAt || '',
          }),
        });
        const j = await r.json();
        if (!r.ok) {
          if (r.status === 409 && j.error === 'poi_has_events') throw Error('poiDeleteHasEvents');
          throw Error(j.error || window.AppI18n.t('failedSave'));
        }
        data = j.map;
        data.theme = window.BurnigatorTheme.apply(data.theme);
        renderPois();
        draw();
        say(window.AppI18n.t('saveSuccess'));
      } catch (e) {
        say(
          e.message === 'poiDeleteHasEvents' ? window.AppI18n.t('poiDeleteHasEvents') : userError(e.message),
          true
        );
      }
    }
    document.getElementById('save-pois').onclick = async () => {
      if (role !== 'poi') return;
      if (hasIncompleteEvent([...data.pois, ...data.timelines])) return;
      if (hasInvalidEventTime([...data.pois, ...data.timelines])) {
        say(window.AppI18n.t('invalidEventTime'), true);
        return;
      }
      window.trackAppEvent?.('Admin', 'poi_save_all');
      try {
        const r = await fetch('api.php?action=save-pois', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
          body: JSON.stringify({ pois: data.pois, expectedUpdatedAt: data.updatedAt || '' }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error || window.AppI18n.t('failedSave'));
        data = j.map;
        data.theme = window.BurnigatorTheme.apply(data.theme);
        renderPois();
        draw();
        say(window.AppI18n.t('saveSuccess'));
      } catch (e) {
        say(userError(e.message), true);
      }
    };
    async function refreshHistory() {
      if (role !== 'owner') return;
      try {
        const r = await fetch('api.php?action=history', { cache: 'no-store' }),
          j = await r.json(),
          host = document.getElementById('change-history');
        host.replaceChildren();
        (j.history || []).forEach((item) => {
          const row = document.createElement('div');
          row.className = 'history-entry';
          const date = document.createElement('time');
          date.dateTime = item.at;
          date.textContent = new Intl.DateTimeFormat(window.AppI18n.lang() === 'de' ? 'de-DE' : 'en-GB', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(item.at));
          const who = document.createElement('strong');
          who.textContent = (item.username || 'owner') + ' · ' + (item.role || 'owner');
          const what = document.createElement('span');
          what.textContent = window.AppI18n.t('history_' + item.action);
          if (item.count) what.textContent += ' (' + item.count + ')';
          if (item.detail) {
            const detail = document.createElement('small');
            detail.className = 'history-detail';
            detail.textContent = item.detail;
            row.append(date, who, what, detail);
          } else row.append(date, who, what);
          host.appendChild(row);
        });
        if (!host.children.length) host.textContent = window.AppI18n.t('historyEmpty');
      } catch (_) {}
    }
    if (role === 'owner') {
      fetch('api.php?action=accounts', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          document.getElementById('poi-account-username').value = j.accounts?.poi?.username || 'poi-editor';
          document.getElementById('www-account-username').value = j.accounts?.www?.username || 'www-editor';
        })
        .catch(() => {});
      refreshHistory();
      setInterval(refreshHistory, 30000);
      if (publicationToggle)
        publicationToggle.onclick = async () => {
          const nextPublished = data.published === false;
          if (!nextPublished && !confirm(window.AppI18n.t('confirmUnpublish'))) return;
          publicationToggle.disabled = true;
          try {
            const r = await fetch('api.php?action=set-publication', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
              body: JSON.stringify({ published: nextPublished, expectedUpdatedAt: data.updatedAt || '' }),
            });
            const j = await r.json();
            if (!r.ok) throw Error(j.error || 'publication_save_failed');
            data.published = j.map.published;
            data.updatedAt = j.map.updatedAt;
            renderPublication();
            say(window.AppI18n.t('publicationSaved'));
            refreshHistory();
          } catch (e) {
            say(
              e.message === 'map_conflict'
                ? window.AppI18n.t('mapConflict')
                : window.AppI18n.t('publicationFailed'),
              true
            );
          } finally {
            publicationToggle.disabled = false;
            renderPublication();
          }
        };
      document.getElementById('save-accounts').onclick = async () => {
        const poiPassword = document.getElementById('poi-account-password').value,
          poiConfirm = document.getElementById('poi-account-password-repeat').value,
          wwwPassword = document.getElementById('www-account-password').value,
          wwwConfirm = document.getElementById('www-account-password-repeat').value;
        if (poiPassword !== poiConfirm || wwwPassword !== wwwConfirm) {
          say(window.AppI18n.t('passwordMismatch'), true);
          return;
        }
        const payload = {
          accounts: {
            poi: {
              username: document.getElementById('poi-account-username').value,
              password: poiPassword,
              passwordConfirm: poiConfirm,
            },
            www: {
              username: document.getElementById('www-account-username').value,
              password: wwwPassword,
              passwordConfirm: wwwConfirm,
            },
          },
        };
        try {
          const r = await fetch('api.php?action=save-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
            body: JSON.stringify(payload),
          });
          const j = await r.json();
          if (!r.ok) throw Error(j.error || window.AppI18n.t('accountsFailed'));
          [
            'poi-account-password',
            'poi-account-password-repeat',
            'www-account-password',
            'www-account-password-repeat',
          ].forEach((id) => (document.getElementById(id).value = ''));
          say(window.AppI18n.t('accountsSaved'));
          refreshHistory();
        } catch (e) {
          say(userError(e.message), true);
        }
      };
      document.getElementById('save-owner-password').onclick = async () => {
        const current = document.getElementById('owner-current-password').value,
          password = document.getElementById('owner-new-password').value,
          confirmPassword = document.getElementById('owner-new-password-repeat').value;
        if (password.length < 12) {
          say(window.AppI18n.t('passwordShort'), true);
          return;
        }
        if (password !== confirmPassword) {
          say(window.AppI18n.t('passwordMismatch'), true);
          return;
        }
        try {
          const r = await fetch('api.php?action=change-owner-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MAP_CSRF },
            body: JSON.stringify({ currentPassword: current, password, passwordConfirm: confirmPassword }),
          });
          const j = await r.json();
          if (!r.ok) throw Error(j.error || 'password_save_failed');
          window.MAP_CSRF = j.csrf || window.MAP_CSRF;
          ['owner-current-password', 'owner-new-password', 'owner-new-password-repeat'].forEach(
            (id) => (document.getElementById(id).value = '')
          );
          say(window.AppI18n.t('ownerPasswordSaved'));
          refreshHistory();
        } catch (e) {
          say(userError(e.message), true);
        }
      };
    }
    document.getElementById('save-map').onclick = () => {
      window.trackAppEvent?.('Admin', 'map_save');
      persistMap();
    };
    ['save-appearance', 'save-categories', 'save-tracking', 'save-soundcloud'].forEach((id) => {
      const button = document.getElementById(id);
      button.onclick = () => {
        window.trackAppEvent?.('Admin', id.replace('save-', '') + '_save');
        persistMap();
      };
    });
    document.getElementById('import-map').onchange = async (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        say(window.AppI18n.t('importInvalid'), true);
        return;
      }
      if (!confirm(window.AppI18n.t('importConfirm'))) return;
      window.trackAppEvent?.('Admin', 'data_import');
      try {
        const imported = JSON.parse(await file.text());
        if (
          !imported ||
          imported.format !== 'image-map-export' ||
          imported.version !== 1 ||
          !Array.isArray(imported.categories) ||
          !Array.isArray(imported.pois) ||
          (imported.timelines !== undefined && !Array.isArray(imported.timelines))
        )
          throw Error('format');
        data = {
          ...data,
          title: typeof imported.title === 'string' ? imported.title : data.title,
          theme: window.BurnigatorTheme.normalize(imported.theme || data.theme),
          qrUrl: typeof imported.qrUrl === 'string' ? imported.qrUrl : '',
          impressUrl: typeof imported.impressUrl === 'string' ? imported.impressUrl : '',
          weekStart: programDays.includes(imported.weekStart) ? imported.weekStart : 'mon',
          enabledDays: Array.isArray(imported.enabledDays) ? imported.enabledDays : programDays,
          titleLinkUrl: typeof imported.titleLinkUrl === 'string' ? imported.titleLinkUrl : '',
          matomoUrl: typeof imported.matomoUrl === 'string' ? imported.matomoUrl : data.matomoUrl || '',
          matomoSiteId: String(imported.matomoSiteId || data.matomoSiteId || ''),
          browserTranslationEnabled: imported.browserTranslationEnabled === true,
          soundcloudEnabled: imported.soundcloudEnabled !== false,
          soundcloudPlaylist: imported.soundcloudPlaylist || '',
          iconMode: imported.iconMode === 'colored' ? 'colored' : 'monochrome',
          categories: imported.categories.slice(0, 100),
          pois: imported.pois.slice(0, 2000),
          timelines: (Array.isArray(imported.timelines) ? imported.timelines : data.timelines)
            .slice(0, 3)
            .map((t) => ({ ...t, program: normalizeProgram(t.program) })),
        };
        data.pois.forEach((p) => {
          p.hasProgram = p.hasProgram === true;
          p.program = normalizeProgram(p.program);
        });
        document.getElementById('title').value = data.title;
        setThemeFields(data.theme);
        document.getElementById('www-qr-url').value = data.qrUrl || '';
        document.getElementById('impress-url').value = data.impressUrl || '';
        document.getElementById('week-start').value = programDays.includes(data.weekStart)
          ? data.weekStart
          : 'mon';
        setEnabledDayFields();
        document.getElementById('title-link-url').value = data.titleLinkUrl || '';
        document.getElementById('matomo-url').value = data.matomoUrl ?? '';
        document.getElementById('matomo-site-id').value = data.matomoSiteId ?? '';
        document.getElementById('browser-translation-enabled').checked =
          data.browserTranslationEnabled === true;
        document.getElementById('soundcloud-enabled').checked = data.soundcloudEnabled !== false;
        document.getElementById('soundcloud-playlist').value = data.soundcloudPlaylist;
        document.getElementById('icon-mode').value = data.iconMode;
        renderCategories();
        renderPois();
        renderTimelines();
        draw();
        await persistMap(window.AppI18n.t('importSuccess'));
      } catch (_) {
        say(window.AppI18n.t('importInvalid'), true);
      }
    };
    if (map)
      map.on('click', (e) => {
        if (!data.image) return say(window.AppI18n.t('needImage'), true);
        window.trackAppEvent?.('Admin', 'poi_add');
        const p = {
          id: newId(),
          x: clamp(e.latlng.lng / data.width),
          y: clamp(-e.latlng.lat / data.height),
          name: window.AppI18n.t('locationName'),
          description: '',
          categoryId: '',
          icon: 'fa-location-dot',
          hasProgram: false,
          program: normalizeProgram({}),
          unsaved: true,
        };
        data.pois.push(p);
        renderPois();
        draw();
      });
    window.addEventListener('image-map-language-change', () => {
      const heading = document.querySelector('.topbar h1');
      if (heading)
        heading.textContent = window.AppI18n.t(
          role === 'poi' ? 'poiEditorTitle' : role === 'www' ? 'wwwEditorTitle' : 'adminTitle'
        );
      renderPublication();
      renderCategories();
      renderPois();
      renderTimelines();
    });
    window.BurnigatorAdminBackup = {
      getData: () => data,
      setData: (map) => {
        data = map;
        data.timelines = Array.isArray(data.timelines) ? data.timelines : [];
        data.theme = window.BurnigatorTheme.normalize(data.theme);
        setThemeFields(data.theme);
        document.getElementById('title').value = data.title || '';
        document.getElementById('custom-button-label').value = data.customButton?.label || '';
        document.getElementById('custom-button-url').value = data.customButton?.url || '';
        document.getElementById('www-qr-url').value = data.qrUrl || '';
        document.getElementById('impress-url').value = data.impressUrl || '';
        document.getElementById('week-start').value = programDays.includes(data.weekStart)
          ? data.weekStart
          : 'mon';
        setEnabledDayFields();
        document.getElementById('title-link-url').value = data.titleLinkUrl || '';
        document.getElementById('matomo-url').value = data.matomoUrl ?? '';
        document.getElementById('matomo-site-id').value = data.matomoSiteId ?? '';
        document.getElementById('browser-translation-enabled').checked =
          data.browserTranslationEnabled === true;
        document.getElementById('soundcloud-enabled').checked = data.soundcloudEnabled !== false;
        document.getElementById('soundcloud-playlist').value = data.soundcloudPlaylist || '';
        document.getElementById('icon-mode').value = data.iconMode || 'monochrome';
        renderCategories();
        renderPois();
        renderTimelines();
        draw();
      },
      say,
      refreshHistory,
    };
    bootStage = 'map-render';
    draw();
    bootStage = 'editor-render';
    try {
      renderCategories();
      renderPois();
      renderTimelines();
    } catch (error) {
      console.error('Burnigator admin editor initialization failed', error);
      showDataLoadError(window.AppI18n.t('adminInitializationFailed'));
    }
    window.BurnigatorAdminReady = true;
    window.dispatchEvent(new Event('burnigator-admin-ready'));
  } catch (error) {
    console.error('Burnigator admin initialization failed at ' + bootStage, error);
    const message =
      window.AppI18n?.t('adminInitializationFailed') ||
      'The admin panel could not be loaded. Reload the page.';
    const host = document.getElementById('map');
    if (host) {
      const panel = document.createElement('div');
      panel.className = 'map-load-error';
      panel.setAttribute('role', 'alert');
      const text = document.createElement('p');
      text.textContent = message;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button-primary';
      retry.textContent = window.AppI18n?.t('retry') || 'Retry';
      retry.onclick = () => window.location.reload();
      panel.append(text, retry);
      host.replaceChildren(panel);
    }
    const status = document.getElementById('status');
    if (status) status.textContent = message;
  }
})();
