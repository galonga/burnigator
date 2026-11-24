(async function () {
  const {
    timeMinutes,
    eventSpan,
    eventTimeLabel,
    formatTime,
    isRecentlyChanged,
    currentAndUpcoming,
    findClashes,
  } = window.BurnigatorTimetable;
  const { buildLink, parseLink, stripLink, findEvent } = window.BurnigatorDeepLink;
  // Favourite events that overlap on the selected day: key -> titles of the events they overlap with.
  let currentClashes = new Map();
  if ('serviceWorker' in navigator)
    navigator.serviceWorker
      .register('./sw.php', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => {});
  function trackVisitorClick(action, label) {
    window.trackAppEvent?.('Visitor', action, String(label || ''));
  }
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
  document.getElementById('refresh-data')?.addEventListener('click', (event) => {
    const activeTab = document.getElementById('timetable-view')?.hidden ? 'map' : 'timetable';
    saveActiveTab(activeTab);
    window.trackAppEvent?.('Visitor', 'refresh_data');
    event.currentTarget.disabled = true;
    event.currentTarget.classList.add('is-refreshing');
    const label = event.currentTarget.querySelector('span');
    if (label) label.textContent = window.AppI18n.t('refreshingData');
    setTimeout(() => window.location.reload(), 180);
  });
  let response, data;
  try {
    response = await fetch('api.php', { cache: 'no-store' });
    if (!response.ok) throw new Error('http');
    data = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray(data.categories) || !Array.isArray(data.pois))
      throw new Error('data');
    data.theme = window.BurnigatorTheme.apply(data.theme);
  } catch (_) {
    showMapLoadError();
    return;
  }
  window.BurnigatorStats?.init(data);
  if (data.published === false) {
    const banner = document.createElement('p');
    banner.className = 'preview-banner';
    banner.dataset.i18n = 'previewOnly';
    const updateBanner = () => {
      banner.textContent = window.AppI18n.t('previewOnly');
    };
    updateBanner();
    window.addEventListener('image-map-language-change', updateBanner);
    document.querySelector('main')?.prepend(banner);
    document.querySelectorAll('.visitor-install-button').forEach((button) => (button.hidden = true));
  }
  document.querySelectorAll('[role="tablist"]').forEach(enableTablistKeys);
  function showMapLoadError() {
    const container = document.getElementById('map');
    if (!container) return;
    document.getElementById('map-view').hidden = false;
    document.getElementById('timetable-view').hidden = true;
    document.getElementById('map-tab').classList.add('active');
    document.getElementById('map-tab').setAttribute('aria-selected', 'true');
    document.getElementById('timetable-tab').classList.remove('active');
    document.getElementById('timetable-tab').setAttribute('aria-selected', 'false');
    const panel = document.createElement('div');
    panel.className = 'map-load-error';
    panel.setAttribute('role', 'alert');
    const message = document.createElement('p');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button button-primary';
    const updateText = () => {
      message.textContent = window.AppI18n.t('mapLoadFailed');
      retry.textContent = window.AppI18n.t('retry');
    };
    updateText();
    window.addEventListener('image-map-language-change', updateText);
    retry.onclick = () => window.location.reload();
    panel.append(message, retry);
    container.replaceChildren(panel);
  }
  const updatedLabel = document.getElementById('last-updated');
  if (updatedLabel) {
    const updatedAt = Date.parse(data.updatedAt || '');
    const offline = response.headers.get('X-Burnigator-Data-Source') === 'offline-cache';
    const renderUpdated = () => {
      const localTime = Number.isNaN(updatedAt)
        ? window.AppI18n.t('timeUnknown')
        : new Intl.DateTimeFormat(window.AppI18n.lang() === 'de' ? 'de-DE' : 'en-GB', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(updatedAt));
      updatedLabel.textContent = window.AppI18n.t(offline ? 'dataOffline' : 'dataOnline') + ' · ' + localTime;
      updatedLabel.title = updatedLabel.textContent;
    };
    renderUpdated();
    window.addEventListener('image-map-language-change', renderUpdated);
  }
  initSoundCloudPlayer(data);
  // Organizer announcement. A visitor who dismissed it sees it again only when it changes.
  (function showAnnouncement(announcement) {
    if (!announcement?.text) return;
    const seenKey = 'burnigatorAnnouncementSeenV1';
    try {
      if (localStorage.getItem(seenKey) === (announcement.updatedAt || announcement.text)) return;
    } catch (_) {}
    const banner = document.createElement('div');
    banner.className = 'announcement-banner' + (announcement.level === 'warning' ? ' is-warning' : '');
    banner.setAttribute('role', announcement.level === 'warning' ? 'alert' : 'status');
    const icon = document.createElement('i');
    icon.className =
      'fa-solid ' + (announcement.level === 'warning' ? 'fa-triangle-exclamation' : 'fa-bullhorn');
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('p');
    text.textContent = announcement.text;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'announcement-close button-light';
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fa-solid fa-xmark';
    closeIcon.setAttribute('aria-hidden', 'true');
    close.appendChild(closeIcon);
    const updateLabel = () => {
      close.setAttribute('aria-label', window.AppI18n.t('announcementDismiss'));
      close.title = close.getAttribute('aria-label');
    };
    updateLabel();
    window.addEventListener('image-map-language-change', updateLabel);
    close.addEventListener('click', () => {
      try {
        localStorage.setItem(seenKey, announcement.updatedAt || announcement.text);
      } catch (_) {}
      window.trackAppEvent?.('Visitor', 'announcement_dismiss');
      banner.remove();
    });
    banner.append(icon, text, close);
    document.querySelector('main')?.prepend(banner);
  })(data.announcement);
  const mapTitle = document.getElementById('map-title'),
    mapLogo = document.getElementById('map-logo');
  mapTitle.textContent = data.title || 'Event';
  document.title = 'Burnigator — ' + (data.title || 'Event');
  const custom = data.customButton || {},
    customTarget = document.getElementById('custom-topbar-button');
  if (custom.label && /^https?:\/\//i.test(custom.url || '')) {
    const link = document.createElement('a');
    link.className = 'visitor-tab chip-button custom-topbar-button button-outlined';
    link.href = custom.url;
    link.textContent = custom.label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    customTarget.replaceChildren(link);
  }
  const hasCustomLogo = /^uploads\/logo-[a-f0-9]{24}\.png$/.test(data.logo || '');
  if (hasCustomLogo) {
    mapLogo.src = data.logo;
    mapLogo.alt = data.title || 'Hamburn';
  }
  const syncBranding = () => {
    const mobile = window.matchMedia('(max-width:760px)').matches;
    mapLogo.hidden = !hasCustomLogo || mobile;
    mapTitle.hidden = hasCustomLogo || mobile;
  };
  syncBranding();
  window.addEventListener('resize', syncBranding);
  if (/^uploads\/favicon-[a-f0-9]{24}\.png$/.test(data.favicon || '')) {
    document.getElementById('site-favicon').href = data.favicon;
  }
  const map = L.map('map', { crs: L.CRS.Simple, minZoom: -5, zoomSnap: 0.25 });
  let mapHasBeenShown = false;
  const legend = document.getElementById('legend'),
    list = document.getElementById('place-list');
  const allDayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const firstDayIndex = Math.max(0, allDayKeys.indexOf(data.weekStart));
  const dayKeys = [...allDayKeys.slice(firstDayIndex), ...allDayKeys.slice(0, firstDayIndex)];
  const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const eventCategories = [
    ['performance', 'fa-masks-theater', '#F08A24'],
    ['music', 'fa-music', '#305EAA'],
    ['kink', 'fa-heart', '#E63D1A'],
    ['adultMind', 'fa-brain', '#E94F85'],
    ['kidsMind', 'fa-people-group', '#8C6BB1'],
    ['movement', 'fa-person-running', '#E9B949'],
    ['quiet', 'fa-volume-low', '#7C8795'],
    ['loud', 'fa-volume-high', '#6B245B'],
    ['crafting', 'fa-scissors', '#3D806B'],
  ];
  const festivalDay = () => weekdayKeys[new Date().getDay()];
  let selectedDay = festivalDay(),
    daySelectionTouched = false;
  const preferencesKey = 'imageMapCategoryPrefs';
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem(preferencesKey) || '{}') || {};
  } catch (_) {}
  const favoriteEventsKey = 'burnigatorFavoriteEventsV1',
    favoriteFilterKey = 'burnigatorFavoriteFilterV1',
    categoryFilterKey = 'burnigatorEventCategoryFilterV1';
  let favoriteEvents = new Set(),
    selectedEventCategories = new Set();
  let favoriteOnly = false;
  try {
    favoriteEvents = new Set(JSON.parse(localStorage.getItem(favoriteEventsKey) || '[]'));
    favoriteOnly = localStorage.getItem(favoriteFilterKey) === 'true';
    const savedCategories = JSON.parse(localStorage.getItem(categoryFilterKey) || '[]');
    if (Array.isArray(savedCategories))
      selectedEventCategories = new Set(
        savedCategories.filter((key) => eventCategories.some(([category]) => category === key))
      );
  } catch (_) {}
  const categoryStates = new Map(),
    poiEls = [];
  const categories = Object.fromEntries((data.categories || []).map((c) => [c.id, c]));
  let imageBounds = null;
  if (data.image) {
    imageBounds = [
      [-data.height, 0],
      [0, data.width],
    ];
    L.imageOverlay(data.image, imageBounds).addTo(map);
  } else {
    const el = document.getElementById('map');
    const showPending = () => {
      el.textContent = window.AppI18n.t('mapPending');
    };
    showPending();
    el.classList.add('empty-map');
    window.addEventListener('image-map-language-change', showPending);
  }
  (data.categories || []).forEach((c) => {
    const saved = prefs[c.id] || {};
    categoryStates.set(c.id, { visible: saved.visible !== false, labels: saved.labels === true });
    const row = document.createElement('div');
    row.className = 'legend-row';
    row.dataset.categoryId = c.id;
    const dot = document.createElement('i');
    dot.style.backgroundColor = safeColor(c.color);
    row.appendChild(dot);
    const name = document.createElement('span');
    name.className = 'legend-name';
    name.textContent = c.name;
    row.appendChild(name);
    const controls = document.createElement('div');
    controls.className = 'category-controls';
    const labels = toggle('showPoiNames', categoryStates.get(c.id).labels),
      visible = toggle('showCategory', categoryStates.get(c.id).visible);
    controls.append(labels, visible);
    row.appendChild(controls);
    legend.appendChild(row);
    labels.querySelector('input').onchange = (e) => {
      window.trackAppEvent?.('Visitor', 'category_name_labels', e.target.checked ? 'show' : 'hide');
      categoryStates.get(c.id).labels = e.target.checked;
      storePrefs();
      refreshCategory(c.id);
    };
    visible.querySelector('input').onchange = (e) => {
      window.trackAppEvent?.('Visitor', 'category_visibility', e.target.checked ? 'show' : 'hide');
      categoryStates.get(c.id).visible = e.target.checked;
      storePrefs();
      refreshCategory(c.id);
    };
  });
  function toggle(labelKey, checked) {
    const wrap = document.createElement('label');
    wrap.className = 'category-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.setAttribute('aria-label', window.AppI18n.t(labelKey));
    input.dataset.i18nAria = labelKey;
    const text = document.createElement('span');
    text.textContent = window.AppI18n.t(labelKey);
    text.dataset.i18n = labelKey;
    wrap.append(input, text);
    return wrap;
  }
  function storePrefs() {
    const out = {};
    categoryStates.forEach((s, id) => (out[id] = s));
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(out));
    } catch (_) {}
  }
  (data.pois || []).forEach((p) => {
    const cat = categories[p.categoryId],
      color = cat ? safeColor(cat.color) : '#E94F85';
    const dot = document.createElement('span');
    dot.className = 'poi-dot';
    dot.style.backgroundColor = color;
    dot.appendChild(makeGlyph(p.icon, data.iconMode));
    const poiLabel = p.name || window.AppI18n.t('locationName');
    const marker = L.marker([-p.y * data.height, p.x * data.width], {
      icon: L.divIcon({
        className: 'poi-marker',
        html: dot.outerHTML,
        iconSize: [39, 39],
        iconAnchor: [19.5, 19.5],
      }),
    }).addTo(map);
    marker.getElement()?.setAttribute('aria-label', poiLabel);
    marker.on('mouseover', () => marker.openTooltip());
    marker.on('mouseout', () => marker.closeTooltip());
    marker.on('click', () => {
      window.BurnigatorStats?.hit('poi_open', p.id);
      trackVisitorClick('poi_click', poiLabel);
      marker.closeTooltip();
    });
    marker.on('popupopen', () => trackVisitorClick('poi_details_open', poiLabel));
    const title = document.createElement('strong');
    title.className = 'program-tooltip-title';
    title.textContent = p.name || window.AppI18n.t('locationName');
    const body = document.createElement('div');
    body.className = 'popup';
    const titleHeader = document.createElement('div');
    titleHeader.className = 'program-tooltip-header map-poi-header';
    titleHeader.appendChild(title);
    if (p.id) titleHeader.appendChild(makeShareButton('poi', p.id, p.name || ''));
    body.appendChild(titleHeader);
    if (p.description) {
      const d = document.createElement('p');
      d.className = 'program-tooltip-description';
      d.textContent = p.description;
      body.appendChild(d);
    }
    if (p.hasProgram) {
      const programLink = document.createElement('a');
      programLink.href = '#timetable';
      programLink.className = 'program-tooltip-translate button-outlined';
      programLink.textContent = window.AppI18n.t('programLink');
      programLink.onclick = (e) => {
        e.preventDefault();
        openTimetableForPoi(p.id);
      };
      body.appendChild(programLink);
    }
    marker.bindPopup(body, {
      maxWidth: Math.min(900, Math.max(280, window.innerWidth - 32)),
      autoPanPadding: [16, 16],
    });
    marker.bindTooltip(p.name || window.AppI18n.t('locationName'), {
      permanent: false,
      direction: 'top',
      offset: [0, -17],
      className: 'poi-name-label',
    });
    const entry = document.createElement('div');
    entry.className = 'place-list-entry';
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'place-item button-light';
    const itemIcon = document.createElement('span');
    itemIcon.className = 'place-item-icon';
    itemIcon.style.backgroundColor = color;
    itemIcon.appendChild(makeGlyph(p.icon, data.iconMode));
    const itemCopy = document.createElement('span');
    itemCopy.className = 'place-item-copy';
    const itemName = document.createElement('span');
    itemName.className = 'place-item-name';
    itemName.textContent = p.name || window.AppI18n.t('locationName');
    itemCopy.appendChild(itemName);
    if (cat) {
      const itemCategory = document.createElement('small');
      itemCategory.className = 'place-item-category';
      itemCategory.textContent = cat.name;
      itemCopy.appendChild(itemCategory);
    }
    item.append(itemIcon, itemCopy);
    item.onclick = () => {
      window.BurnigatorStats?.hit('poi_open', p.id);
      trackVisitorClick('poi_click', p.name || window.AppI18n.t('locationName'));
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 0));
      marker.openPopup();
    };
    entry.appendChild(item);
    if (p.hasProgram) {
      const link = document.createElement('a');
      link.className = 'poi-program-link button-outlined';
      link.href = '#timetable';
      link.textContent = window.AppI18n.t('programLink');
      link.dataset.i18n = 'programLink';
      link.onclick = (e) => {
        e.preventDefault();
        openTimetableForPoi(p.id);
      };
      entry.appendChild(link);
    }
    entry.dataset.search = [p.name, p.description, cat?.name, p.icon]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase(window.AppI18n.lang());
    list.appendChild(entry);
    poiEls.push({ p, catId: p.categoryId, marker, item: entry });
  });
  function refreshCategory(id) {
    const state = categoryStates.get(id) || { visible: true, labels: false };
    const query = document.getElementById('poi-search').value.trim().toLocaleLowerCase(window.AppI18n.lang());
    poiEls
      .filter((x) => x.catId === id)
      .forEach(({ marker, item }) => {
        if (state.visible) {
          if (!map.hasLayer(marker)) marker.addTo(map);
        } else if (map.hasLayer(marker)) map.removeLayer(marker);
        item.hidden = !state.visible || !item.dataset.search.includes(query);
        if (state.visible && state.labels) marker.openTooltip();
        else marker.closeTooltip();
      });
    document.getElementById('poi-search').dispatchEvent(new Event('input'));
  }
  const shareToast = document.getElementById('share-toast');
  let shareToastTimer;
  function showShareToast(text) {
    if (!shareToast) return;
    shareToast.textContent = text;
    shareToast.hidden = false;
    shareToast.classList.remove('show');
    requestAnimationFrame(() => shareToast.classList.add('show'));
    clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => {
      shareToast.classList.remove('show');
      setTimeout(() => (shareToast.hidden = true), 250);
    }, 2400);
  }
  // Uses the system share sheet where there is one, otherwise copies the link.
  async function shareLink(type, id, title) {
    const url = buildLink(window.location.href, type, id);
    window.trackAppEvent?.('Visitor', 'share_link', type + ' | ' + title);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showShareToast(window.AppI18n.t('shareCopied'));
    } catch (_) {
      window.prompt(window.AppI18n.t('shareLink'), url);
    }
  }
  function makeShareButton(type, id, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'program-tooltip-share button-light';
    button.setAttribute('aria-label', window.AppI18n.t('shareLink'));
    button.title = button.getAttribute('aria-label');
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-share-nodes';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    button.addEventListener('click', (click) => {
      click.preventDefault();
      click.stopPropagation();
      shareLink(type, id, title);
    });
    return button;
  }
  function openMapPoi(id) {
    const entry = poiEls.find((item) => item.p.id === id);
    if (!entry) return;
    if (entry.catId && categoryStates.has(entry.catId)) {
      const state = categoryStates.get(entry.catId);
      if (!state.visible) {
        state.visible = true;
        const row = Array.from(legend.children).find((item) => item.dataset.categoryId === entry.catId);
        const controls = row?.querySelectorAll('.category-toggle input');
        if (controls?.[1]) controls[1].checked = true;
        storePrefs();
        refreshCategory(entry.catId);
      }
    }
    switchTab('map');
    setTimeout(() => {
      map.invalidateSize();
      map.setView(entry.marker.getLatLng(), Math.max(map.getZoom(), 0));
      entry.marker.openPopup();
    }, 90);
  }
  categoryStates.forEach((_, id) => refreshCategory(id));
  if (!(data.pois || []).length) list.textContent = window.AppI18n.t('noPlaces');
  let searchTrackTimer;
  document.getElementById('poi-search').addEventListener('input', (event) => {
    clearTimeout(searchTrackTimer);
    if (event.target.value.trim())
      searchTrackTimer = setTimeout(() => window.trackAppEvent?.('Visitor', 'poi_search', 'used'), 700);
    const query = event.target.value.trim().toLocaleLowerCase(window.AppI18n.lang());
    let matches = 0;
    list.querySelectorAll('.place-list-entry').forEach((item) => {
      const poi = poiEls.find((x) => x.item === item),
        state = categoryStates.get(poi?.catId);
      const visible = item.dataset.search.includes(query) && (!state || state.visible);
      item.hidden = !visible;
      if (visible) matches++;
    });
    let empty = list.querySelector('.search-empty');
    if (query && matches === 0) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'search-empty';
        list.appendChild(empty);
      }
      empty.textContent = window.AppI18n.t('noMatches');
    } else if (empty) empty.remove();
  });
  const ownedEventIds = new Set();
  let eventOwnerCsrfCookie = '';
  async function loadEventOwnerStatus() {
    try {
      const response = await fetch('api.php?action=event-owner-status', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('http');
      const status = await response.json();
      ownedEventIds.clear();
      if (status.authenticated && Array.isArray(status.ownedEventIds))
        status.ownedEventIds.forEach((id) => ownedEventIds.add(id));
      eventOwnerCsrfCookie = typeof status.csrfCookie === 'string' ? status.csrfCookie : '';
    } catch (_) {
      ownedEventIds.clear();
    }
    hideEventTooltip();
  }
  function readCookie(name) {
    const match = document.cookie.split('; ').find((part) => part.startsWith(name + '='));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
  }
  async function saveOwnedEvent(event, values) {
    const response = await fetch('api.php?action=event-owner-save', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-CSRF': readCookie(eventOwnerCsrfCookie),
      },
      body: JSON.stringify({ eventId: event.id, ...values }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.error || 'event_save_failed');
      error.status = response.status;
      throw error;
    }
    Object.assign(event, result.event);
  }
  loadEventOwnerStatus();
  window.addEventListener('burnigator-event-auth-changed', loadEventOwnerStatus);
  renderTimetable();
  function legacyEventFavoriteKey(ownerId, day, event) {
    return JSON.stringify([ownerId, day, event.start || event.time || '', event.end || '', event.text || '']);
  }
  function eventFavoriteKey(ownerId, day, event) {
    return typeof event.id === 'string' && event.id
      ? JSON.stringify(['event-v2', ownerId, day, event.id])
      : legacyEventFavoriteKey(ownerId, day, event);
  }
  function eventIsFavorite(ownerId, day, event) {
    const key = eventFavoriteKey(ownerId, day, event);
    if (favoriteEvents.has(key)) return true;
    if (
      key !== legacyEventFavoriteKey(ownerId, day, event) &&
      favoriteEvents.has(legacyEventFavoriteKey(ownerId, day, event))
    ) {
      favoriteEvents.delete(legacyEventFavoriteKey(ownerId, day, event));
      favoriteEvents.add(key);
      try {
        localStorage.setItem(favoriteEventsKey, JSON.stringify([...favoriteEvents]));
      } catch (_) {}
      return true;
    }
    return false;
  }
  function eventShown(ownerId, day, event) {
    const eventCategoryList = Array.isArray(event?.categories) ? event.categories : [];
    return !!(
      event &&
      String(event.text || '').trim() &&
      (!favoriteOnly || eventIsFavorite(ownerId, day, event)) &&
      (!selectedEventCategories.size ||
        eventCategoryList.some((category) => selectedEventCategories.has(category)))
    );
  }
  function syncTimelineFavorite(ownerId, day, event) {
    const key = eventFavoriteKey(ownerId, day, event),
      isFavorite = favoriteEvents.has(key);
    document.querySelectorAll('.timeline-event').forEach((block) => {
      if (block.dataset.favoriteKey !== key) return;
      block.classList.toggle('is-favorite', isFavorite);
      let indicator = block.querySelector('.timeline-favorite-indicator');
      if (isFavorite && !indicator) {
        indicator = document.createElement('i');
        indicator.className = 'timeline-favorite-indicator fa-solid fa-heart';
        indicator.setAttribute('aria-hidden', 'true');
        block.appendChild(indicator);
      } else if (!isFavorite && indicator) indicator.remove();
    });
  }
  function makeTimelineEvent(ownerId, ownerName, item, laneIndex) {
    const { day, event, start, end } = item;
    const wrap = document.createElement('div');
    wrap.className = 'timeline-event-wrap';
    wrap.style.left = (start / 1440) * 100 + '%';
    wrap.style.width = (Math.max(end - start, 15) / 1440) * 100 + '%';
    wrap.style.top = 8 + laneIndex * 56 + 'px';
    const block = document.createElement('button');
    block.type = 'button';
    block.className = 'timeline-event';
    block.dataset.favoriteKey = eventFavoriteKey(ownerId, day, event);
    if (event.id) block.dataset.eventId = event.id;
    block.style.backgroundColor = eventBoxColor(event.categories);
    block.style.borderColor = eventBoxColor(event.categories);
    block.style.color = '#fff';
    const time = document.createElement('time');
    time.textContent = eventTimeLabel(event, item);
    block.classList.toggle('is-overnight', item.overnight);
    block.classList.toggle('is-continued', item.continued);
    const text = document.createElement('span');
    text.textContent = event.text;
    const selected = Array.isArray(event.categories) ? event.categories : [];
    const label = document.createElement('span');
    label.className = 'timeline-event-label';
    label.appendChild(text);
    block.append(time, label);
    if (eventIsFavorite(ownerId, day, event)) {
      block.classList.add('is-favorite');
      const indicator = document.createElement('i');
      indicator.className = 'timeline-favorite-indicator fa-solid fa-heart';
      indicator.setAttribute('aria-hidden', 'true');
      block.appendChild(indicator);
    }
    const changed = isRecentlyChanged(event);
    if (changed) {
      block.classList.add('is-changed');
      const badge = document.createElement('i');
      badge.className = 'timeline-changed-badge fa-solid fa-circle-exclamation';
      badge.setAttribute('aria-hidden', 'true');
      block.appendChild(badge);
    }
    block.title =
      (changed ? window.AppI18n.t('eventChanged') + ': ' : '') + time.textContent + ' ' + event.text;
    block.addEventListener('click', () =>
      trackVisitorClick(
        'event_click',
        ownerName + ' | ' + day + ' | ' + time.textContent + ' | ' + event.text
      )
    );
    block.setAttribute(
      'aria-label',
      time.textContent +
        ' ' +
        event.text +
        (selected.length
          ? '. ' +
            selected
              .map((key) => window.AppI18n.t('eventCategory' + key[0].toUpperCase() + key.slice(1)))
              .join(', ')
          : '') +
        (changed ? '. ' + window.AppI18n.t('eventChanged') : '') +
        (event.host ? '. ' + window.AppI18n.t('eventHostLabel') + ': ' + event.host : '') +
        (event.description ? '. ' + event.description : '')
    );
    block.dataset.baseLabel = block.getAttribute('aria-label');
    applyClash(block);
    bindEventTooltip(block, event, ownerId, ownerName, day);
    wrap.appendChild(block);
    return wrap;
  }
  // A function declaration (hoisted): renderTimetable() already runs during start-up, before this point.
  function clashHint(titles) {
    return window.AppI18n.t('clashHint').replace('{names}', titles.join(', '));
  }
  // Optional feature: owners switch it on in the settings (liveTimetableEnabled, off by default).
  function liveTimetableOn() {
    return data.liveTimetableEnabled === true;
  }
  function computeClashes() {
    if (!liveTimetableOn()) return new Map();
    const items = [],
      titles = new Map();
    const owners = [...(data.pois || []).filter((p) => p.hasProgram), ...(data.timelines || []).slice(0, 3)];
    owners.forEach((owner) =>
      timelineItems(owner.id, owner.program, selectedDay, (id, d, e) => eventIsFavorite(id, d, e)).forEach(
        (item) => {
          const key = eventFavoriteKey(owner.id, item.day, item.event);
          items.push({ key, start: item.start, end: item.end });
          titles.set(key, item.event.text || '');
        }
      )
    );
    const result = new Map();
    findClashes(items).forEach((others, key) =>
      result.set(
        key,
        others.map((other) => titles.get(other))
      )
    );
    return result;
  }
  function applyClash(block) {
    const titles = currentClashes.get(block.dataset.favoriteKey) || [];
    block.classList.toggle('is-clash', titles.length > 0);
    let badge = block.querySelector('.timeline-clash-badge');
    if (titles.length && !badge) {
      badge = document.createElement('i');
      badge.className = 'timeline-clash-badge fa-solid fa-triangle-exclamation';
      badge.setAttribute('aria-hidden', 'true');
      block.appendChild(badge);
    } else if (!titles.length && badge) badge.remove();
    const base = block.dataset.baseLabel || '';
    block.setAttribute('aria-label', titles.length ? base + '. ' + clashHint(titles) : base);
  }
  function renderClashSummary() {
    const host = document.getElementById('timetable-content');
    let note = document.getElementById('clash-summary');
    if (!currentClashes.size) {
      note?.remove();
      return;
    }
    if (!note) {
      note = document.createElement('p');
      note.id = 'clash-summary';
      note.className = 'clash-summary';
      note.setAttribute('role', 'status');
      host.prepend(note);
    }
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.setAttribute('aria-hidden', 'true');
    note.replaceChildren(
      icon,
      ' ' + window.AppI18n.t('clashSummary').replace('{n}', String(currentClashes.size))
    );
  }
  // Recomputes the overlaps after a favourite was added or removed, without re-rendering the table.
  function refreshClashes() {
    currentClashes = computeClashes();
    document.querySelectorAll('#timetable-content .timeline-event').forEach(applyClash);
    renderClashSummary();
  }
  function renderNowNext() {
    const dayHost = document.getElementById('timetable-days');
    if (!dayHost) return;
    if (!liveTimetableOn()) {
      document.getElementById('now-next')?.remove();
      return;
    }
    let strip = document.getElementById('now-next');
    if (!strip) {
      strip = document.createElement('section');
      strip.id = 'now-next';
      strip.className = 'now-next';
      strip.hidden = true;
      // First child section of the timetable view that follows its heading, i.e. above the filters.
      const view = document.getElementById('timetable-view');
      const anchor = view?.querySelector('.timetable-filter-section, .timetable-day-section');
      if (anchor && anchor.parentNode === view) view.insertBefore(strip, anchor);
      else (view || dayHost.parentNode).appendChild(strip);
      window.addEventListener('image-map-language-change', () => {
        strip.dataset.signature = '';
        renderNowNext();
      });
    }
    const today = festivalDay(),
      entries = [];
    [...(data.pois || []).filter((p) => p.hasProgram), ...(data.timelines || []).slice(0, 3)].forEach(
      (owner) =>
        timelineItems(owner.id, owner.program, today, () => true).forEach((item) =>
          entries.push({ ownerId: owner.id, ownerName: owner.name || '', item })
        )
    );
    const clock = new Date(),
      { now, next } = currentAndUpcoming(entries, clock.getHours() * 60 + clock.getMinutes());
    const favoriteOf = (entry) => eventIsFavorite(entry.ownerId, entry.item.day, entry.item.event);
    const signature = [...now, ...next]
      .map((entry) => eventFavoriteKey(entry.ownerId, entry.item.day, entry.item.event) + favoriteOf(entry))
      .join('|');
    strip.hidden = !entries.length;
    if (!entries.length || strip.dataset.signature === signature) return;
    strip.dataset.signature = signature;
    strip.setAttribute('aria-label', window.AppI18n.t('nowNextLabel'));
    const group = (headingKey, list, emptyKey) => {
      const wrap = document.createElement('div');
      wrap.className = 'now-next-group';
      const heading = document.createElement('strong');
      heading.textContent = window.AppI18n.t(headingKey);
      const chips = document.createElement('div');
      chips.className = 'now-next-chips';
      if (!list.length) {
        const empty = document.createElement('span');
        empty.className = 'hint';
        empty.textContent = window.AppI18n.t(emptyKey);
        chips.appendChild(empty);
      }
      list.forEach((entry) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'now-next-chip chip-button';
        const time = document.createElement('time');
        time.textContent = eventTimeLabel(entry.item.event, entry.item);
        const title = document.createElement('span');
        title.textContent = entry.item.event.text;
        const place = document.createElement('small');
        place.textContent = entry.ownerName;
        chip.append(time, title, place);
        if (favoriteOf(entry)) {
          const heart = document.createElement('i');
          heart.className = 'fa-solid fa-heart';
          heart.setAttribute('aria-hidden', 'true');
          chip.appendChild(heart);
        }
        chip.addEventListener('click', () => openFromNowNext(entry));
        chips.appendChild(chip);
      });
      wrap.append(heading, chips);
      return wrap;
    };
    strip.replaceChildren(
      group('nowNextNow', now, 'nowNextNothingNow'),
      group('nowNextNext', next, 'nowNextNothingNext')
    );
  }
  function openFromNowNext(entry) {
    const { event, day } = entry.item;
    window.trackAppEvent?.('Visitor', 'now_next_open', entry.ownerName + ' | ' + event.text);
    // Show everything, so a saved filter cannot hide the event that was just chosen.
    if (!eventShown(entry.ownerId, day, event)) {
      favoriteOnly = false;
      selectedEventCategories = new Set();
    }
    selectedDay = day;
    daySelectionTouched = true;
    renderTimetable();
    setTimeout(() => {
      const block = [...document.querySelectorAll('#timetable-content .timeline-event')].find(
        (el) => el.dataset.eventId === event.id && !el.classList.contains('is-continued')
      );
      if (!block) return;
      block.scrollIntoView({ block: 'center', inline: 'center' });
      block.click();
    }, 60);
  }
  function renderTimetable() {
    const host = document.getElementById('timetable-content'),
      dayHost = document.getElementById('timetable-days'),
      previousScrollLeft = host.querySelector('.timetable-scroll')?.scrollLeft || 0;
    host.replaceChildren();
    const dayHadFocus = dayHost.contains(document.activeElement);
    dayHost.replaceChildren();
    renderNowNext();
    let filterRow = document.getElementById('timetable-filters');
    if (!filterRow) {
      filterRow = document.createElement('div');
      filterRow.id = 'timetable-filters';
      filterRow.className = 'timetable-filter-row';
      dayHost.parentNode.insertBefore(filterRow, dayHost);
    }
    let favoriteFilter = document.getElementById('favorite-filter');
    if (!favoriteFilter) {
      favoriteFilter = document.createElement('button');
      favoriteFilter.id = 'favorite-filter';
      favoriteFilter.type = 'button';
      favoriteFilter.className = 'chip-button timetable-day timetable-filter-button favorite-filter';
      favoriteFilter.setAttribute('aria-pressed', 'false');
      const heart = document.createElement('i');
      heart.className = 'filter-favorite-icon';
      heart.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.dataset.i18n = 'favoriteFilter';
      label.textContent = window.AppI18n.t('favoriteFilter');
      favoriteFilter.append(heart, label);
      favoriteFilter.onclick = () => {
        hideEventTooltip();
        favoriteOnly = !favoriteOnly;
        try {
          localStorage.setItem(favoriteFilterKey, String(favoriteOnly));
        } catch (_) {}
        window.trackAppEvent?.('Visitor', 'favorite_filter', favoriteOnly ? 'enabled' : 'disabled');
        renderTimetable();
      };
      filterRow.appendChild(favoriteFilter);
    }
    favoriteFilter.setAttribute('aria-pressed', String(favoriteOnly));
    favoriteFilter.classList.toggle('active', favoriteOnly);
    favoriteFilter.querySelector('.filter-favorite-icon').className =
      'filter-favorite-icon ' + (favoriteOnly ? 'fa-solid' : 'fa-regular') + ' fa-heart';
    let categoryFilter = document.getElementById('event-category-filter'),
      categoryPanel;
    if (!categoryFilter) {
      const container = document.createElement('div');
      container.id = 'event-category-filter-container';
      container.className = 'event-category-filter-container';
      categoryFilter = document.createElement('button');
      categoryFilter.id = 'event-category-filter';
      categoryFilter.type = 'button';
      categoryFilter.className = 'chip-button timetable-day timetable-filter-button';
      categoryFilter.setAttribute('aria-pressed', 'false');
      categoryFilter.setAttribute('aria-expanded', 'false');
      categoryFilter.setAttribute('aria-controls', 'event-category-filter-options');
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-filter';
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.dataset.i18n = 'filterEventCategories';
      label.textContent = window.AppI18n.t('filterEventCategories');
      const count = document.createElement('span');
      count.className = 'event-category-filter-count';
      categoryFilter.append(icon, label, count);
      categoryPanel = document.createElement('div');
      categoryPanel.id = 'event-category-filter-options';
      categoryPanel.className = 'event-category-filter-options';
      categoryPanel.setAttribute('role', 'group');
      categoryPanel.setAttribute('aria-label', window.AppI18n.t('filterEventCategories'));
      categoryPanel.dataset.i18nAria = 'filterEventCategories';
      categoryPanel.hidden = true;
      eventCategories.forEach(([key, iconName]) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'event-category-filter-option button-light';
        option.setAttribute('aria-pressed', 'false');
        option.dataset.category = key;
        const name = document.createElement('span');
        name.className = 'event-category-filter-name';
        const glyph = document.createElement('i');
        glyph.className = 'fa-solid ' + iconName;
        glyph.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.dataset.i18n = 'eventCategory' + key[0].toUpperCase() + key.slice(1);
        label.textContent = window.AppI18n.t(label.dataset.i18n);
        name.append(glyph, label);
        const toggle = document.createElement('span');
        toggle.className = 'event-category-filter-switch';
        toggle.setAttribute('aria-hidden', 'true');
        option.append(name, toggle);
        option.onclick = () => {
          hideEventTooltip();
          if (selectedEventCategories.has(key)) selectedEventCategories.delete(key);
          else selectedEventCategories.add(key);
          try {
            localStorage.setItem(categoryFilterKey, JSON.stringify([...selectedEventCategories]));
          } catch (_) {}
          window.trackAppEvent?.(
            'Visitor',
            'event_category_filter',
            [...selectedEventCategories].join(',') || 'all'
          );
          renderTimetable();
        };
        categoryPanel.appendChild(option);
      });
      const hint = document.createElement('p');
      hint.className = 'event-category-filter-hint';
      hint.dataset.i18n = 'eventCategoryFilterHint';
      hint.textContent = window.AppI18n.t('eventCategoryFilterHint');
      categoryPanel.appendChild(hint);
      const fitCategoryPanel = () => {
        if (categoryPanel.hidden) return;
        const mobile = window.matchMedia('(max-width:760px)').matches;
        categoryPanel.style.maxHeight = 'none';
        const viewportTop = window.visualViewport?.offsetTop || 0,
          viewportHeight = window.visualViewport?.height || window.innerHeight,
          viewportBottom = viewportTop + viewportHeight;
        const anchor = mobile ? filterRow : categoryFilter,
          rect = anchor.getBoundingClientRect(),
          naturalHeight = categoryPanel.scrollHeight,
          below = Math.max(0, viewportBottom - rect.bottom - 17),
          above = Math.max(0, rect.top - viewportTop - 17),
          openAbove = naturalHeight > below && above > below;
        categoryPanel.style.top = openAbove ? 'auto' : 'calc(100% + 5px)';
        categoryPanel.style.bottom = openAbove ? 'calc(100% + 5px)' : '';
        categoryPanel.style.maxHeight = Math.floor(openAbove ? above : below) + 'px';
      };
      categoryFilter.onclick = () => {
        const open = categoryPanel.hidden;
        categoryPanel.hidden = !open;
        categoryFilter.setAttribute('aria-expanded', String(open));
        if (open) fitCategoryPanel();
      };
      window.addEventListener('resize', fitCategoryPanel, { passive: true });
      window.visualViewport?.addEventListener('resize', fitCategoryPanel, { passive: true });
      container.append(categoryFilter, categoryPanel);
      filterRow.appendChild(container);
      document.addEventListener('click', (event) => {
        if (!container.contains(event.target)) {
          categoryPanel.hidden = true;
          categoryFilter.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !categoryPanel.hidden) {
          categoryPanel.hidden = true;
          categoryFilter.setAttribute('aria-expanded', 'false');
          categoryFilter.focus();
        }
      });
    } else {
      categoryPanel = document.getElementById('event-category-filter-options');
    }
    categoryFilter.setAttribute('aria-pressed', String(selectedEventCategories.size > 0));
    categoryFilter.classList.toggle('active', selectedEventCategories.size > 0);
    categoryFilter.querySelector('.event-category-filter-count').textContent = selectedEventCategories.size
      ? String(selectedEventCategories.size)
      : '';
    categoryPanel.querySelectorAll('.event-category-filter-option').forEach((option) => {
      const active = selectedEventCategories.has(option.dataset.category);
      option.setAttribute('aria-pressed', String(active));
      option.classList.toggle('active', active);
    });
    const entries = (data.pois || []).filter((p) => p.hasProgram);
    const independentTimelines = (data.timelines || []).slice(0, 3);
    const hasEvents = (day) =>
      entries.some((p) => timelineItems(p.id, p.program, day).length) ||
      independentTimelines.some((t) => timelineItems(t.id, t.program, day).length);
    const visibleDays = dayKeys.filter(hasEvents);
    document.querySelector('.timetable-day-section').hidden = !visibleDays.length;
    const today = festivalDay();
    if (!daySelectionTouched && visibleDays.includes(today)) selectedDay = today;
    else if (!visibleDays.includes(selectedDay)) selectedDay = visibleDays[0] || today;
    visibleDays.forEach((day) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-button timetable-day' + (day === selectedDay ? ' active' : '');
      button.textContent = window.AppI18n.t('day' + day[0].toUpperCase() + day.slice(1));
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(day === selectedDay));
      button.onclick = () => {
        daySelectionTouched = true;
        selectedDay = day;
        window.trackAppEvent?.('Visitor', 'www_day_select', day);
        renderTimetable();
      };
      dayHost.appendChild(button);
      if (dayHadFocus && day === selectedDay) button.focus({ preventScroll: true });
    });
    const exportButton = document.getElementById('export-day-jpg');
    exportButton.hidden = !visibleDays.length;
    if (!visibleDays.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = window.AppI18n.t(
        selectedEventCategories.size
          ? 'noEventsForFilters'
          : favoriteOnly
            ? 'noFavoriteEvents'
            : 'noProgramPois'
      );
      host.appendChild(empty);
      return;
    }
    currentClashes = computeClashes();
    const scroll = document.createElement('div');
    scroll.className = 'timetable-scroll';
    const table = document.createElement('table');
    table.className = 'festival-timetable';
    const head = document.createElement('thead'),
      hr = document.createElement('tr');
    const placeHead = document.createElement('th');
    placeHead.scope = 'col';
    placeHead.className = 'timeline-place-heading';
    placeHead.textContent = window.AppI18n.t('timetableRowHeading');
    hr.appendChild(placeHead);
    const axisHead = document.createElement('th');
    axisHead.colSpan = 24;
    axisHead.className = 'timeline-axis-heading';
    const hourLabels = document.createElement('div');
    hourLabels.className = 'hour-labels';
    for (let hour = 0; hour < 24; hour++) {
      const label = document.createElement('span');
      label.textContent = String(hour).padStart(2, '0') + ':00';
      hourLabels.appendChild(label);
    }
    axisHead.appendChild(hourLabels);
    hr.appendChild(axisHead);
    head.appendChild(hr);
    const tbody = document.createElement('tbody');
    entries
      .filter((p) => timelineItems(p.id, p.program, selectedDay).length)
      .forEach((p) => {
        const tr = document.createElement('tr');
        tr.id = 'timetable-' + p.id;
        const name = document.createElement('th');
        name.scope = 'row';
        name.className = 'timeline-place-name';
        const mapLink = document.createElement('a');
        mapLink.className = 'timeline-map-link';
        mapLink.href = '#map';
        mapLink.textContent = p.name || window.AppI18n.t('locationName');
        mapLink.onclick = (e) => {
          e.preventDefault();
          openMapPoi(p.id);
        };
        name.appendChild(mapLink);
        tr.appendChild(name);
        const cell = document.createElement('td');
        cell.colSpan = 24;
        cell.className = 'timeline-cell';
        for (let hour = 0; hour <= 24; hour++) {
          const line = document.createElement('i');
          line.className = 'timeline-hour-line';
          line.style.left = (hour / 24) * 100 + '%';
          cell.appendChild(line);
        }
        const lanes = [];
        timelineItems(p.id, p.program, selectedDay).forEach((item) => {
          const lane = lanes.findIndex((laneEnd) => laneEnd <= item.start);
          const laneIndex = lane < 0 ? lanes.length : lane;
          if (lane < 0) lanes.push(item.end);
          else lanes[laneIndex] = item.end;
          cell.appendChild(makeTimelineEvent(p.id, p.name || p.id, item, laneIndex));
        });
        cell.style.height = Math.max(58, lanes.length * 56 + 16) + 'px';
        tr.appendChild(cell);
        tbody.appendChild(tr);
      });
    const activeIndependent = independentTimelines
      .map((timeline) => ({
        ...timeline,
        events: timelineItems(timeline.id, timeline.program, selectedDay),
      }))
      .filter((timeline) => timeline.events.length);
    if (activeIndependent.length) {
      const divider = document.createElement('tr');
      divider.className = 'timeline-independent-divider';
      const dividerCell = document.createElement('th');
      dividerCell.colSpan = 25;
      dividerCell.textContent = window.AppI18n.t('independentTimelines');
      divider.appendChild(dividerCell);
      tbody.appendChild(divider);
    }
    activeIndependent.forEach((timeline) => {
      const tr = document.createElement('tr');
      tr.className = 'timeline-independent-row';
      tr.id = 'timeline-wide-' + timeline.id;
      const name = document.createElement('th');
      name.scope = 'row';
      name.className = 'timeline-place-name timeline-independent-name';
      name.textContent = timeline.name;
      tr.appendChild(name);
      const cell = document.createElement('td');
      cell.colSpan = 24;
      cell.className = 'timeline-cell';
      for (let hour = 0; hour <= 24; hour++) {
        const line = document.createElement('i');
        line.className = 'timeline-hour-line';
        line.style.left = (hour / 24) * 100 + '%';
        cell.appendChild(line);
      }
      const lanes = [];
      timeline.events.forEach((item) => {
        const lane = lanes.findIndex((laneEnd) => laneEnd <= item.start);
        const laneIndex = lane < 0 ? lanes.length : lane;
        if (lane < 0) lanes.push(item.end);
        else lanes[laneIndex] = item.end;
        cell.appendChild(makeTimelineEvent(timeline.id, timeline.name, item, laneIndex));
      });
      cell.style.height = Math.max(58, lanes.length * 56 + 16) + 'px';
      tr.appendChild(cell);
      tbody.appendChild(tr);
    });
    table.append(head, tbody);
    scroll.appendChild(table);
    host.appendChild(scroll);
    if (previousScrollLeft) scroll.scrollLeft = previousScrollLeft;
    renderClashSummary();
    updateCurrentTimeIndicators();
  }
  function updateCurrentTimeIndicators() {
    document.querySelectorAll('.current-time-indicator').forEach((line) => line.remove());
    const today = festivalDay();
    if (selectedDay !== today) return;
    const now = new Date(),
      minute = now.getHours() * 60 + now.getMinutes(),
      label = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    document.querySelectorAll('.hour-labels,.timeline-cell').forEach((parent) => {
      const line = document.createElement('i');
      line.className = 'current-time-indicator';
      line.style.left = (minute / 1440) * 100 + '%';
      line.title = label;
      line.setAttribute('aria-hidden', 'true');
      parent.appendChild(line);
    });
  }
  setInterval(() => {
    updateCurrentTimeIndicators();
    renderNowNext();
  }, 60000);
  function eventBoxColor(selected) {
    const keys = Array.isArray(selected) ? selected : [];
    const adult = eventCategories.find(
      ([key]) => (key === 'kink' || key === 'adultMind') && keys.includes(key)
    );
    return adult?.[2] || eventCategories.find(([key]) => keys.includes(key))?.[2] || '#E94F85';
  }
  function contrastTextColor(background) {
    const hex = String(background || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return '#fff';
    const luminance = [0, 2, 4]
      .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const black = (luminance + 0.05) / 0.05,
      white = 1.05 / (luminance + 0.05);
    return black >= white ? '#111' : '#fff';
  }
  function timelineItems(ownerId, program, day, isVisible = (id, d, e) => eventShown(id, d, e)) {
    return window.BurnigatorTimetable.timelineItems(ownerId, program, day, isVisible, allDayKeys);
  }
  function openTimetableForPoi(id) {
    const poi = (data.pois || []).find((p) => p.id === id);
    const firstDay = dayKeys.find((day) => Array.isArray(poi?.program?.[day]) && poi.program[day].length);
    if (firstDay) {
      selectedDay = firstDay;
      daySelectionTouched = true;
    }
    renderTimetable();
    switchTab('timetable');
    setTimeout(
      () =>
        document.getElementById('timetable-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      50
    );
  }
  let activeEventTooltip = null,
    detailHistoryActive = false;
  let tooltipSequence = 0;
  function saveActiveTab(tab) {
    const url = new URL(window.location.href);
    url.searchParams.set('burnigatorView', tab);
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    history.replaceState({ ...state, burnigatorView: tab }, '', url.href);
    try {
      sessionStorage.setItem('burnigatorActiveTab', tab);
    } catch (_) {}
  }
  function openDetailHistory() {
    if (detailHistoryActive) return;
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    history.pushState({ ...state, burnigatorDetail: true }, '', location.href);
    detailHistoryActive = true;
  }
  function clearDetailHistory() {
    if (!detailHistoryActive) return;
    detailHistoryActive = false;
    history.back();
  }
  map.on('popupopen', () => {
    if (activeEventTooltip) hideEventTooltip(undefined, true);
    openDetailHistory();
  });
  map.on('popupclose', () =>
    setTimeout(() => {
      if (!activeEventTooltip && !document.querySelector('.leaflet-popup')) clearDetailHistory();
    }, 0)
  );
  window.addEventListener('popstate', () => {
    if (!detailHistoryActive) return;
    detailHistoryActive = false;
    hideEventTooltip(undefined, true);
    map.closePopup();
  });
  function bindEventTooltip(trigger, event, ownerId, ownerName, day) {
    const show = () => {
      if (activeEventTooltip?.trigger === trigger) {
        hideEventTooltip(trigger);
        return;
      }
      hideEventTooltip(undefined, true);
      map.closePopup();
      window.BurnigatorStats?.hit('event_open', event.id);
      const popup = document.createElement('div');
      popup.className = 'program-event-popup';
      popup.setAttribute('role', 'dialog');
      popup.id = 'program-event-tooltip-' + ++tooltipSequence;
      const header = document.createElement('div');
      header.className = 'program-tooltip-header';
      const eventTitle = document.createElement('strong');
      eventTitle.className = 'program-tooltip-title';
      eventTitle.id = popup.id + '-title';
      eventTitle.textContent = event.text || window.AppI18n.t('eventTitle');
      popup.setAttribute('aria-labelledby', eventTitle.id);
      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.className = 'program-tooltip-favorite button-light';
      favorite.setAttribute('aria-pressed', String(eventIsFavorite(ownerId, day, event)));
      const heart = document.createElement('i');
      heart.setAttribute('aria-hidden', 'true');
      const syncFavorite = () => {
        const isFavorite = eventIsFavorite(ownerId, day, event);
        heart.className = (isFavorite ? 'fa-solid' : 'fa-regular') + ' fa-heart';
        favorite.setAttribute('aria-pressed', String(isFavorite));
        favorite.setAttribute('aria-label', window.AppI18n.t(isFavorite ? 'removeFavorite' : 'addFavorite'));
        favorite.title = favorite.getAttribute('aria-label');
      };
      syncFavorite();
      favorite.appendChild(heart);
      favorite.addEventListener('click', (click) => {
        click.preventDefault();
        click.stopPropagation();
        const key = eventFavoriteKey(ownerId, day, event),
          wasFavorite = favoriteEvents.has(key);
        if (wasFavorite) favoriteEvents.delete(key);
        else favoriteEvents.add(key);
        try {
          localStorage.setItem(favoriteEventsKey, JSON.stringify([...favoriteEvents]));
        } catch (_) {}
        window.BurnigatorStats?.action(wasFavorite ? 'favorite_remove' : 'favorite_add', event.id);
        window.trackAppEvent?.(
          'Visitor',
          'event_favorite_toggle',
          ownerName + ' | ' + day + ' | ' + event.text
        );
        syncFavorite();
        syncTimelineFavorite(ownerId, day, event);
        refreshClashes();
        syncClash();
        renderNowNext();
        if (favoriteOnly && wasFavorite) {
          hideEventTooltip(trigger);
          renderTimetable();
        }
      });
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'program-tooltip-close button-light';
      close.setAttribute('aria-label', window.AppI18n.t('closeDetails'));
      close.title = close.getAttribute('aria-label');
      const closeIcon = document.createElement('i');
      closeIcon.className = 'fa-solid fa-xmark';
      closeIcon.setAttribute('aria-hidden', 'true');
      close.appendChild(closeIcon);
      close.addEventListener('click', (click) => {
        click.preventDefault();
        click.stopPropagation();
        hideEventTooltip(trigger);
      });
      header.append(eventTitle);
      if (event.id) header.append(makeShareButton('event', event.id, event.text || ''));
      header.append(favorite);
      if (event.id && ownedEventIds.has(event.id)) {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'program-tooltip-edit button-light';
        edit.setAttribute('aria-label', window.AppI18n.t('editEvent'));
        edit.title = edit.getAttribute('aria-label');
        const editIcon = document.createElement('i');
        editIcon.className = 'fa-solid fa-pen';
        editIcon.setAttribute('aria-hidden', 'true');
        edit.appendChild(editIcon);
        edit.addEventListener('click', (click) => {
          click.preventDefault();
          click.stopPropagation();
          window.trackAppEvent?.('Visitor', 'event_owner_edit_open', ownerName + ' | ' + event.text);
          showOwnerEditor(popup, header, event, trigger);
        });
        header.appendChild(edit);
      }
      header.appendChild(close);
      popup.appendChild(header);
      if (isRecentlyChanged(event)) {
        const changedNote = document.createElement('p');
        changedNote.className = 'program-tooltip-changed';
        const changedIcon = document.createElement('i');
        changedIcon.className = 'fa-solid fa-circle-exclamation';
        changedIcon.setAttribute('aria-hidden', 'true');
        changedNote.append(changedIcon, ' ' + window.AppI18n.t('eventChanged'));
        popup.appendChild(changedNote);
      }
      const clashNote = document.createElement('p');
      clashNote.className = 'program-tooltip-clash';
      clashNote.setAttribute('role', 'status');
      const favoriteKey = eventFavoriteKey(ownerId, day, event);
      const syncClash = () => {
        const titles = currentClashes.get(favoriteKey) || [];
        clashNote.hidden = !titles.length;
        clashNote.textContent = titles.length ? clashHint(titles) : '';
      };
      syncClash();
      popup.appendChild(clashNote);
      if (event.host) {
        const host = document.createElement('p');
        host.className = 'program-tooltip-host';
        host.textContent = window.AppI18n.t('eventHostLabel') + ': ' + event.host;
        popup.appendChild(host);
      }
      if (event.description) {
        const description = document.createElement('p');
        description.className = 'program-tooltip-description';
        description.textContent = event.description;
        popup.appendChild(description);
        if (data.browserTranslationEnabled === true) {
          const translate = document.createElement('button');
          translate.type = 'button';
          translate.className = 'program-tooltip-translate button-outlined';
          translate.textContent = window.AppI18n.t('translateDescription');
          translate.setAttribute('aria-live', 'polite');
          let translatedText = '';
          translate.addEventListener('click', async (click) => {
            click.preventDefault();
            click.stopPropagation();
            if (translatedText) {
              description.textContent = event.description;
              translatedText = '';
              translate.textContent = window.AppI18n.t('translateDescription');
              return;
            }
            const Detector = window.LanguageDetector,
              Translator = window.Translator;
            if (!Translator || typeof Translator.create !== 'function') {
              translate.textContent = window.AppI18n.t('translationUnavailable');
              return;
            }
            translate.disabled = true;
            translate.textContent = window.AppI18n.t('translationLoading');
            try {
              const target = window.AppI18n.lang();
              let source = target === 'en' ? 'de' : 'en';
              if (Detector && typeof Detector.create === 'function') {
                const detector = await Detector.create(),
                  detected = await detector.detect(event.description);
                source = (detected?.[0]?.detectedLanguage || source).split('-')[0];
                detector.destroy?.();
              }
              if (source === target) {
                translate.textContent = window.AppI18n.t('translationSameLanguage');
                return;
              }
              const availability = await Translator.availability({
                sourceLanguage: source,
                targetLanguage: target,
              });
              if (availability === 'unavailable') throw new Error('unavailable');
              const translator = await Translator.create({ sourceLanguage: source, targetLanguage: target });
              translatedText = await translator.translate(event.description);
              translator.destroy?.();
              description.textContent = translatedText;
              translate.textContent = window.AppI18n.t('translationShowOriginal');
            } catch (_) {
              translate.textContent = window.AppI18n.t('translationUnavailable');
            } finally {
              translate.disabled = false;
            }
          });
          popup.appendChild(translate);
        }
      }
      const selected = Array.isArray(event.categories) ? event.categories : [];
      if (selected.length) {
        const categories = document.createElement('div');
        categories.className = 'program-tooltip-categories';
        eventCategories
          .filter(([key]) => selected.includes(key))
          .forEach(([key, iconName]) => {
            const chip = document.createElement('span');
            chip.className = 'program-tooltip-category';
            const icon = document.createElement('i');
            icon.className = 'fa-solid ' + iconName;
            icon.setAttribute('aria-hidden', 'true');
            const name = document.createElement('span');
            name.textContent = window.AppI18n.t('eventCategory' + key[0].toUpperCase() + key.slice(1));
            chip.append(icon, name);
            categories.appendChild(chip);
          });
        popup.appendChild(categories);
      }
      if (event.linkUrl) {
        const link = document.createElement('a');
        link.className = 'program-tooltip-link button-text';
        link.href = event.linkUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = event.linkText || event.linkUrl;
        popup.appendChild(link);
      }
      document.body.appendChild(popup);
      const rect = trigger.getBoundingClientRect(),
        margin = 8;
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - popup.offsetWidth - margin));
      const above = rect.top > popup.offsetHeight + margin * 2;
      popup.classList.toggle('is-above', above);
      popup.style.left = left + 'px';
      popup.style.top = (above ? rect.top - margin : rect.bottom + margin) + 'px';
      if (above) popup.style.transform = 'translateY(-100%)';
      trigger.setAttribute('aria-controls', popup.id);
      trigger.setAttribute('aria-expanded', 'true');
      activeEventTooltip = { trigger, popup };
      // Move focus into the dialog so keyboard and screen-reader users land on it; closing returns it.
      popup.tabIndex = -1;
      popup.focus({ preventScroll: true });
      openDetailHistory();
    };
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      show();
    });
  }
  function showOwnerEditor(popup, header, event, trigger) {
    [...popup.children].forEach((child) => {
      if (child !== header) child.remove();
    });
    const form = document.createElement('form');
    form.className = 'program-owner-form';
    const field = (labelKey, control) => {
      const label = document.createElement('label');
      const text = document.createElement('span');
      text.textContent = window.AppI18n.t(labelKey);
      label.append(text, control);
      return label;
    };
    const start = document.createElement('input');
    start.type = 'time';
    start.required = true;
    start.value = event.start || '';
    const end = document.createElement('input');
    end.type = 'time';
    end.value = event.end || '';
    const times = document.createElement('div');
    times.className = 'program-owner-times';
    const overnightNote = document.createElement('p');
    overnightNote.className = 'program-entry-note';
    overnightNote.setAttribute('role', 'status');
    overnightNote.textContent = window.AppI18n.t('eventOvernight');
    overnightNote.hidden = true;
    const syncOvernight = () => {
      overnightNote.hidden = !(start.value && end.value && end.value < start.value && end.value !== '00:00');
    };
    start.addEventListener('input', syncOvernight);
    end.addEventListener('input', syncOvernight);
    syncOvernight();
    times.append(field('eventStart', start), field('eventEnd', end), overnightNote);
    const host = document.createElement('input');
    host.type = 'text';
    host.maxLength = 200;
    host.value = event.host || '';
    const description = document.createElement('textarea');
    description.maxLength = 1000;
    description.rows = 4;
    description.value = event.description || '';
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'program-owner-categories';
    const legend = document.createElement('legend');
    legend.textContent = window.AppI18n.t('eventCategories');
    fieldset.appendChild(legend);
    const selected = new Set(Array.isArray(event.categories) ? event.categories : []);
    eventCategories.forEach(([key, iconName]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip-button';
      const icon = document.createElement('i');
      icon.className = 'fa-solid ' + iconName;
      icon.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.textContent = window.AppI18n.t('eventCategory' + key[0].toUpperCase() + key.slice(1));
      chip.append(icon, name);
      const sync = () => {
        chip.classList.toggle('active', selected.has(key));
        chip.setAttribute('aria-pressed', String(selected.has(key)));
      };
      sync();
      chip.addEventListener('click', () => {
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        sync();
      });
      fieldset.appendChild(chip);
    });
    const status = document.createElement('p');
    status.className = 'program-owner-status';
    status.setAttribute('role', 'status');
    const actions = document.createElement('div');
    actions.className = 'program-owner-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'button-primary';
    save.textContent = window.AppI18n.t('save');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button-outlined';
    cancel.textContent = window.AppI18n.t('pinboardCancel');
    cancel.addEventListener('click', (click) => {
      click.preventDefault();
      click.stopPropagation();
      hideEventTooltip(trigger);
    });
    actions.append(save, cancel);
    form.append(
      field('eventHost', host),
      times,
      field('eventDescription', description),
      fieldset,
      status,
      actions
    );
    form.addEventListener('submit', async (submit) => {
      submit.preventDefault();
      submit.stopPropagation();
      status.textContent = '';
      if (end.value && end.value === start.value) {
        status.textContent = window.AppI18n.t('eventEditTimeInvalid');
        return;
      }
      save.disabled = true;
      form.setAttribute('aria-busy', 'true');
      try {
        await saveOwnedEvent(event, {
          start: start.value,
          end: end.value,
          host: host.value,
          description: description.value,
          categories: eventCategories.map(([key]) => key).filter((key) => selected.has(key)),
        });
        window.trackAppEvent?.('Visitor', 'event_owner_edit_save', event.text);
        hideEventTooltip(trigger);
        renderTimetable();
      } catch (error) {
        if (error.status === 403) {
          ownedEventIds.delete(event.id);
          status.textContent = window.AppI18n.t('eventEditForbidden');
        } else if (error.message === 'invalid_event_time') {
          status.textContent = window.AppI18n.t('eventEditTimeInvalid');
        } else status.textContent = window.AppI18n.t('eventEditFailed');
        save.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
    popup.appendChild(form);
    popup.classList.add('is-editing');
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    start.focus();
  }
  document.addEventListener('click', (event) => {
    if (activeEventTooltip && !activeEventTooltip.popup.contains(event.target)) hideEventTooltip();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideEventTooltip();
  });
  window.addEventListener(
    'scroll',
    (event) => {
      if (activeEventTooltip && !activeEventTooltip.popup.contains(event.target)) hideEventTooltip();
    },
    true
  );
  function hideEventTooltip(trigger, preserveHistory = false) {
    if (!activeEventTooltip || (trigger && activeEventTooltip.trigger !== trigger)) return;
    const { trigger: openTrigger, popup } = activeEventTooltip;
    const hadFocus = popup.contains(document.activeElement);
    openTrigger.removeAttribute('aria-controls');
    openTrigger.setAttribute('aria-expanded', 'false');
    popup.remove();
    activeEventTooltip = null;
    if (hadFocus && openTrigger.isConnected) openTrigger.focus({ preventScroll: true });
    if (!preserveHistory) clearDetailHistory();
  }
  let todayTimelinePositioned = false;
  function positionTodayTimelineOnMobile() {
    if (
      todayTimelinePositioned ||
      !window.matchMedia('(max-width:760px)').matches ||
      selectedDay !== festivalDay()
    )
      return;
    const scroll = document.querySelector('#timetable-content .timetable-scroll'),
      table = scroll?.querySelector('.festival-timetable'),
      place = table?.querySelector('.timeline-place-heading'),
      axis = table?.querySelector('.timeline-axis-heading');
    if (!scroll || !axis || scroll.clientWidth <= 0) return;
    const placeWidth = place?.getBoundingClientRect().width || 0,
      timelineWidth = axis.getBoundingClientRect().width,
      timelineViewport = Math.max(0, scroll.clientWidth - placeWidth),
      now = new Date(),
      minute = now.getHours() * 60 + now.getMinutes(),
      target = placeWidth + (timelineWidth * minute) / 1440,
      center = placeWidth + timelineViewport / 2;
    scroll.scrollLeft = Math.max(0, Math.min(target - center, scroll.scrollWidth - scroll.clientWidth));
    todayTimelinePositioned = true;
  }
  function switchTab(tab, track = true) {
    if (track) window.trackAppEvent?.('Visitor', 'view_select', tab);
    const timetable = tab === 'timetable';
    saveActiveTab(timetable ? 'timetable' : 'map');
    document.getElementById('map-view').hidden = timetable;
    document.getElementById('timetable-view').hidden = !timetable;
    const mapTab = document.getElementById('map-tab'),
      timeTab = document.getElementById('timetable-tab');
    mapTab.classList.toggle('active', !timetable);
    timeTab.classList.toggle('active', timetable);
    mapTab.setAttribute('aria-selected', String(!timetable));
    timeTab.setAttribute('aria-selected', String(timetable));
    if (timetable) setTimeout(positionTodayTimelineOnMobile, 50);
    else
      setTimeout(() => {
        map.invalidateSize();
        if (!mapHasBeenShown) {
          if (imageBounds) map.fitBounds(imageBounds, { animate: false });
          else map.setView([0, 0], 0, { animate: false });
          mapHasBeenShown = true;
        }
      }, 50);
  }
  document.getElementById('map-tab').onclick = () => switchTab('map');
  document.getElementById('timetable-tab').onclick = () => switchTab('timetable');
  let restoredTab = '';
  try {
    const urlTab = new URL(window.location.href).searchParams.get('burnigatorView');
    restoredTab =
      urlTab === 'map' || urlTab === 'timetable'
        ? urlTab
        : sessionStorage.getItem('burnigatorActiveTab') || '';
  } catch (_) {}
  if (restoredTab === 'map') switchTab('map', false);
  else switchTab('timetable', false);
  // Links like index.php?event=<id> or ?poi=<id> open that event's details or that place on the map.
  function openDeepLink() {
    const link = parseLink(window.location.search);
    if (!link) return;
    try {
      history.replaceState(history.state, '', stripLink(window.location.href));
    } catch (_) {}
    const notFound = () => showShareToast(window.AppI18n.t('deepLinkNotFound'));
    window.trackAppEvent?.('Visitor', 'deep_link_open', link.type);
    if (link.type === 'poi') {
      if ((data.pois || []).some((p) => p.id === link.id)) openMapPoi(link.id);
      else notFound();
      return;
    }
    const found = findEvent(data, link.id);
    if (!found) return notFound();
    // Show everything, so a saved filter cannot hide the linked event.
    favoriteOnly = false;
    selectedEventCategories = new Set();
    selectedDay = found.day;
    daySelectionTouched = true;
    switchTab('timetable', false);
    renderTimetable();
    setTimeout(() => {
      const block = [...document.querySelectorAll('#timetable-content .timeline-event')].find(
        (el) => el.dataset.eventId === link.id && !el.classList.contains('is-continued')
      );
      if (!block) return notFound();
      block.scrollIntoView({ block: 'center', inline: 'center' });
      block.click();
    }, 120);
  }
  openDeepLink();
  document.getElementById('export-day-jpg').onclick = () => {
    window.trackAppEvent?.('Visitor', 'www_jpg_export', selectedDay);
    exportTimetableJpg();
  };
  document.getElementById('map-export-jpg').onclick = () => {
    window.trackAppEvent?.('Visitor', 'map_jpg_export');
    exportMapJpg();
  };
  async function addJpegResolution(blob, dpi) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
    const jfif = [0x4a, 0x46, 0x49, 0x46, 0x00],
      density = Math.max(1, Math.min(65535, Math.round(dpi)));
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      const payload = offset + 2;
      if (marker === 0xe0 && jfif.every((value, index) => bytes[payload + index] === value)) {
        const units = payload + 7,
          x = payload + 8,
          y = payload + 10;
        bytes[units] = 1;
        bytes[x] = density >> 8;
        bytes[x + 1] = density & 255;
        bytes[y] = density >> 8;
        bytes[y + 1] = density & 255;
        return new Blob([bytes], { type: 'image/jpeg' });
      }
      offset += length;
    }
    const segment = new Uint8Array([
        0xff,
        0xe0,
        0x00,
        0x10,
        0x4a,
        0x46,
        0x49,
        0x46,
        0x00,
        0x01,
        0x02,
        0x01,
        density >> 8,
        density & 255,
        density >> 8,
        density & 255,
        0x00,
        0x00,
      ]),
      output = new Uint8Array(bytes.length + segment.length);
    output.set(bytes.subarray(0, 2));
    output.set(segment, 2);
    output.set(bytes.subarray(2), 2 + segment.length);
    return new Blob([output], { type: 'image/jpeg' });
  }
  function downloadJpg(canvas, filename, options = {}) {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          alert(window.AppI18n.t('jpgExportFailed'));
          return;
        }
        try {
          if (options.dpi) blob = await addJpegResolution(blob, options.dpi);
          const url = URL.createObjectURL(blob),
            link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (_) {
          alert(window.AppI18n.t('jpgExportFailed'));
        }
      },
      'image/jpeg',
      options.quality ?? 0.92
    );
  }
  function exportMapJpg() {
    if (!data.image) {
      alert(window.AppI18n.t('mapPdfNoImage'));
      return;
    }
    const source = new Image();
    source.onload = async () => {
      const categories = data.categories || [],
        pois = data.pois || [];
      let num = 0;
      const items = [];
      categories.forEach((category) =>
        pois
          .filter((p) => p.categoryId === category.id)
          .forEach((p) => items.push({ number: ++num, p, category }))
      );
      pois
        .filter((p) => !categories.some((c) => c.id === p.categoryId))
        .forEach((p) => items.push({ number: ++num, p, category: null }));
      const groups = categories
          .map((category) => ({ category, rows: items.filter((item) => item.category?.id === category.id) }))
          .filter((group) => group.rows.length),
        uncategorized = items.filter((item) => !item.category);
      if (uncategorized.length)
        groups.push({ category: { name: window.AppI18n.t('uncategorized') }, rows: uncategorized });
      const width = 3000,
        mapHeight = 1450,
        indexStart = 1650,
        indexColumnW = 900,
        indexColumnTextW = indexColumnW - 60,
        estimateLines = (text, maxChars) => Math.max(1, Math.ceil(String(text).length / maxChars)),
        columnHeights = [0, 0, 0],
        groupColumns = [];
      groups.forEach((group) => {
        const lines = estimateLines(group.category.name, 58),
          height =
            lines * 36 +
            8 +
            group.rows.reduce(
              (sum, item) =>
                sum +
                estimateLines((item.p.name || window.AppI18n.t('locationName')) + '. ' + item.number, 68) *
                  38,
              0
            ) +
            24,
          col = columnHeights.indexOf(Math.min(...columnHeights));
        groupColumns.push(col);
        columnHeights[col] += height;
      });
      const qrEnabled = typeof data.qrUrl === 'string' && /^https?:\/\//i.test(data.qrUrl),
        height = Math.max(1900, indexStart + Math.max(...columnHeights) + (qrEnabled ? 190 : 70)),
        targetScale = 7016 / width,
        maxPixels = 40000000,
        maxDimension = 32767,
        scale = Math.min(
          targetScale,
          Math.sqrt(maxPixels / (width * height)),
          maxDimension / Math.max(width, height)
        ),
        printDpi = Math.max(1, Math.round((300 * scale) / targetScale)),
        canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fffaf3';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#305eaa';
      ctx.font = 'bold 58px system-ui, sans-serif';
      ctx.fillText(data.title || window.AppI18n.t('map'), 70, 85);
      const area = { x: 70, y: 135, w: 2860, h: mapHeight };
      const imageScale = Math.min(area.w / source.naturalWidth, area.h / source.naturalHeight),
        iw = source.naturalWidth * imageScale,
        ih = source.naturalHeight * imageScale,
        ix = area.x + (area.w - iw) / 2,
        iy = area.y + (area.h - ih) / 2;
      ctx.fillStyle = '#e6d0bb';
      ctx.fillRect(ix, iy, iw, ih);
      ctx.drawImage(source, ix, iy, iw, ih);
      items.forEach(({ number, p }) => {
        const cx = ix + Math.max(0, Math.min(1, Number(p.x) || 0)) * iw,
          cy = iy + Math.max(0, Math.min(1, Number(p.y) || 0)) * ih,
          r = 22;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#305eaa';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 23px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(number), cx, cy);
      });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#305eaa';
      ctx.font = 'bold 46px system-ui, sans-serif';
      ctx.fillText(window.AppI18n.t('poiIndex'), 70, indexStart - 25);
      const drawWrapped = (text, x, y, maxWidth, lineHeight, font, color) => {
        ctx.font = font;
        ctx.fillStyle = color;
        const words = String(text).split(/\s+/);
        let line = '';
        const lines = [];
        for (const word of words) {
          const trial = line ? line + ' ' + word : word;
          if (ctx.measureText(trial).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else line = trial;
        }
        if (line) lines.push(line);
        lines.forEach((part, index) => ctx.fillText(part, x, y + index * lineHeight));
        return y + lines.length * lineHeight;
      };
      const columns = [indexStart, indexStart, indexStart];
      groups.forEach((group, index) => {
        const col = groupColumns[index],
          x = 70 + col * indexColumnW;
        let y = columns[col];
        y =
          drawWrapped(
            group.category.name,
            x,
            y,
            indexColumnW - 50,
            36,
            'bold 28px system-ui, sans-serif',
            '#305eaa'
          ) + 8;
        group.rows.forEach(({ number, p }) => {
          y =
            drawWrapped(
              number + '. ' + (p.name || window.AppI18n.t('locationName')),
              x + 10,
              y,
              indexColumnTextW,
              30,
              '22px system-ui, sans-serif',
              '#26364d'
            ) + 8;
        });
        columns[col] = y + 24;
      });
      if (qrEnabled) {
        try {
          const qr = await renderQrCanvas(data.qrUrl, 116),
            qrX = width - 160,
            qrY = height - 160;
          ctx.fillStyle = '#fff';
          ctx.fillRect(qrX - 8, qrY - 8, 132, 152);
          ctx.drawImage(qr, qrX, qrY, 116, 116);
          const target = data.qrUrl.replace(/^https?:\/\//i, '');
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillStyle = '#26364d';
          ctx.textAlign = 'center';
          let remaining = target;
          const targetLines = [];
          for (let index = 0; index < 2 && remaining; index++) {
            let length = remaining.length;
            while (
              length > 1 &&
              ctx.measureText(remaining.slice(0, length) + (length < remaining.length ? '…' : '')).width > 132
            )
              length--;
            if (length < remaining.length && index === 0) {
              const slash = remaining.slice(0, length).lastIndexOf('/');
              if (slash > length * 0.65) length = slash + 1;
            }
            let line = remaining.slice(0, length);
            remaining = remaining.slice(length);
            if (remaining && index === 1) {
              while (line && ctx.measureText(line + '…').width > 132) line = line.slice(0, -1);
              line = line.replace(/[\s/?.#&_-]+$/, '') + '…';
              remaining = '';
            }
            targetLines.push(line);
          }
          targetLines.forEach((line, index) => ctx.fillText(line, qrX + 58, qrY + 130 + index * 12, 132));
          ctx.textAlign = 'left';
        } catch (_) {
          alert(window.AppI18n.t('jpgExportFailed'));
          return;
        }
      }
      downloadJpg(canvas, 'map-poi-index.jpg', { quality: 0.96, dpi: printDpi });
    };
    source.onerror = () => alert(window.AppI18n.t('mapPdfImageFailed'));
    source.src = new URL(data.image, location.href).href;
  }
  async function renderQrCanvas(value, size) {
    if (!window.QRCode) throw new Error('QR generator unavailable');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + size + 'px;height:' + size + 'px;';
    document.body.appendChild(host);
    try {
      new window.QRCode(host, {
        text: value,
        width: size,
        height: size,
        colorDark: '#111111',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      const canvas = host.querySelector('canvas');
      if (canvas) return canvas;
      const image = host.querySelector('img');
      if (image) {
        if (!image.complete)
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
          });
        const qr = document.createElement('canvas');
        qr.width = size;
        qr.height = size;
        qr.getContext('2d').drawImage(image, 0, 0, size, size);
        return qr;
      }
      throw new Error('QR generation failed');
    } finally {
      host.remove();
    }
  }
  const hasEventText = (id, day, event) => !!String(event?.text || '').trim();
  async function exportTimetableJpg() {
    const entries = [
      ...(data.pois || [])
        .filter((p) => p.hasProgram)
        .map((p) => ({
          name: p.name || window.AppI18n.t('locationName'),
          id: p.id,
          program: p.program,
          events: p.program?.[selectedDay] || [],
        })),
      ...(data.timelines || []).slice(0, 3).map((timeline) => ({
        name: timeline.name,
        id: timeline.id,
        program: timeline.program,
        events: timeline.program?.[selectedDay] || [],
      })),
    ].filter(
      (entry) =>
        entry.events.some((event) => event && String(event.text || '').trim()) ||
        timelineItems(entry.id, entry.program, selectedDay, hasEventText).length
    );
    if (!entries.length) {
      alert(window.AppI18n.t('noProgramPois'));
      return;
    }
    if (document.fonts?.ready) await document.fonts.ready;
    const eventsByPoi = entries.map((entry) =>
      entry.events
        .filter((e) => e && String(e.text || '').trim())
        .slice()
        .sort((a, b) => (a.start || a.time || '').localeCompare(b.start || b.time || ''))
    );
    const itemsByPoi = entries.map((entry) =>
      timelineItems(entry.id, entry.program, selectedDay, hasEventText)
    );
    const usedCategoryKeys = [
      ...new Set(
        eventsByPoi.flatMap((events) =>
          events.flatMap((e) => (Array.isArray(e.categories) ? e.categories : []))
        )
      ),
    ].filter((key) => eventCategories.some(([candidate]) => candidate === key));
    const categoryLabel = (key) => window.AppI18n.t('eventCategory' + key[0].toUpperCase() + key.slice(1));
    const iconGlyph = (iconName) => {
      const el = document.createElement('i');
      el.className = 'fa-solid ' + iconName;
      document.body.appendChild(el);
      const content = getComputedStyle(el, '::before').content;
      el.remove();
      const match = content.match(/\\([0-9a-f]{1,6})/i);
      return match ? String.fromCodePoint(parseInt(match[1], 16)) : '';
    };
    const width = 3000,
      labelWidth = 340,
      timelineWidth = width - labelWidth - 80,
      x0 = labelWidth + 45,
      headerHeight = 170,
      rowGap = 24,
      detailHeadingHeight = 86,
      legendHeadingHeight = 92,
      legendRowHeight = 74,
      descriptionX = 650,
      descriptionWidth = width - descriptionX - 70;
    const measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = 'italic 15px system-ui, sans-serif';
    const wrapDescription = (value) => {
      const lines = [];
      let current = '',
        truncated = false;
      const push = () => {
        lines.push(current);
        current = '';
      };
      const paragraphs = String(value || '')
        .replace(/\r/g, '')
        .split('\n');
      for (let pi = 0; pi < paragraphs.length && !truncated; pi++) {
        const words = paragraphs[pi].split(/\s+/).filter(Boolean);
        if (!words.length) {
          if (pi < paragraphs.length - 1) {
            if (lines.length >= 5) {
              truncated = true;
              break;
            }
            push();
          }
          continue;
        }
        for (const word of words) {
          let rest = word;
          while (rest) {
            const candidate = current ? current + ' ' + rest : rest;
            if (measureCtx.measureText(candidate).width <= descriptionWidth) {
              current = candidate;
              rest = '';
              continue;
            }
            if (current) {
              push();
              if (lines.length >= 5) {
                truncated = true;
                break;
              }
            }
            let cut = rest.length;
            while (cut > 1 && measureCtx.measureText(rest.slice(0, cut)).width > descriptionWidth) cut--;
            current = rest.slice(0, cut);
            rest = rest.slice(cut);
            if (rest) {
              push();
              if (lines.length >= 5) {
                truncated = true;
                break;
              }
            }
          }
          if (truncated) break;
        }
        if (pi < paragraphs.length - 1 && !truncated) {
          if (lines.length >= 5) truncated = true;
          else push();
        }
      }
      if (!truncated && current) push();
      if (truncated) {
        if (current && lines.length < 5) push();
        if (!lines.length) lines.push('');
        let last = lines[Math.min(lines.length, 5) - 1];
        while (last && measureCtx.measureText(last + '..').width > descriptionWidth) last = last.slice(0, -1);
        lines[Math.min(lines.length, 5) - 1] = last.replace(/[\s.,;:!?-]+$/, '') + '..';
      }
      return lines.slice(0, 5);
    };
    const descriptionsByPoi = eventsByPoi.map((events) =>
      events.map((event) => wrapDescription(event.description))
    );
    const wrapEventTitle = (value, maxWidth, maxLines = 3) => {
      measureCtx.font = 'bold 24px system-ui, sans-serif';
      const words = String(value || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean),
        lines = [];
      let line = '',
        truncated = false;
      for (let i = 0; i < words.length; i++) {
        const word = words[i],
          candidate = line ? line + ' ' + word : word;
        if (measureCtx.measureText(candidate).width <= maxWidth) {
          line = candidate;
          continue;
        }
        if (line) {
          lines.push(line);
          line = word;
          if (lines.length >= maxLines) {
            truncated = true;
            break;
          }
        } else {
          line = word;
          truncated = true;
          break;
        }
      }
      if (!truncated && line) {
        lines.push(line);
        if (measureCtx.measureText(line).width > maxWidth) truncated = true;
      }
      if (lines.length > maxLines) {
        lines.length = maxLines;
        truncated = true;
      }
      if (truncated) {
        if (line && lines.length < maxLines) lines.push(line);
        if (lines.length > maxLines) lines.length = maxLines;
        if (!lines.length) lines.push('');
        let last = lines[lines.length - 1];
        while (last && measureCtx.measureText(last + '..').width > maxWidth) last = last.slice(0, -1);
        lines[lines.length - 1] = last.replace(/[\s.,;:!?-]+$/, '') + '..';
      }
      return lines.slice(0, maxLines);
    };
    const rowHeights = itemsByPoi.map((items) => {
      let lanes = [];
      items.forEach(({ start, end }) => {
        const lane = lanes.findIndex((v) => v <= start);
        if (lane < 0) lanes.push(end);
        else lanes[lane] = end;
      });
      return Math.max(154, lanes.length * 160 + 24);
    });
    const detailRowHeights = eventsByPoi.map((events, index) =>
      events.map((event, eventIndex) => Math.max(82, 48 + descriptionsByPoi[index][eventIndex].length * 23))
    );
    const detailHeight = detailRowHeights.flat().reduce((sum, n) => sum + n, 0),
      detailStart = headerHeight + rowHeights.reduce((a, b) => a + b + rowGap, 0) + 24,
      legendStart = detailStart + detailHeadingHeight + detailHeight + 28,
      height =
        legendStart + legendHeadingHeight + Math.ceil(usedCategoryKeys.length / 3) * legendRowHeight + 140;
    const targetScale = 7016 / width,
      maxPixels = 40000000,
      maxDimension = 32767,
      scale = Math.min(
        targetScale,
        Math.sqrt(maxPixels / (width * height)),
        maxDimension / Math.max(width, height)
      ),
      printDpi = Math.max(1, Math.round((300 * scale) / targetScale));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fffaf3';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#305eaa';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(
      (data.title || window.AppI18n.t('timetable')) +
        ' — ' +
        window.AppI18n.t('day' + selectedDay[0].toUpperCase() + selectedDay.slice(1)),
      45,
      72
    );
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#26364d';
    ctx.fillText(window.AppI18n.t('timetableRowHeading'), 45, 144);
    for (let hour = 0; hour <= 24; hour++) {
      const x = x0 + (timelineWidth * hour) / 24;
      ctx.strokeStyle = '#ccB7a5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, headerHeight - 8);
      ctx.lineTo(x, detailStart - 18);
      ctx.stroke();
      if (hour < 24) {
        ctx.fillStyle = '#26364d';
        ctx.font = '17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(hour).padStart(2, '0') + ':00', x + timelineWidth / 48, headerHeight - 20);
      }
    }
    let y = headerHeight;
    entries.forEach((p, index) => {
      const rowH = rowHeights[index];
      ctx.fillStyle = index % 2 ? '#f5eadd' : '#fffaf3';
      ctx.fillRect(0, y, width, rowH);
      ctx.strokeStyle = '#ccB7a5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + rowH);
      ctx.lineTo(width, y + rowH);
      ctx.stroke();
      ctx.fillStyle = '#305eaa';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'left';
      const poiName = p.name || window.AppI18n.t('locationName');
      const words = poiName.split(/\s+/);
      let line = '',
        lines = [];
      words.forEach((word) => {
        const next = line ? line + ' ' + word : word;
        if (ctx.measureText(next).width > labelWidth - 30 && line) {
          lines.push(line);
          line = word;
        } else line = next;
      });
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((text, i) => ctx.fillText(text, 24, y + 38 + i * 29));
      const lanes = [];
      itemsByPoi[index].forEach((item) => {
        const { event, start, end } = item;
        let lane = lanes.findIndex((v) => v <= start);
        if (lane < 0) {
          lane = lanes.length;
          lanes.push(end);
        } else lanes[lane] = end;
        const bx = x0 + (timelineWidth * start) / 1440,
          bw = Math.max(22, (timelineWidth * (end - start)) / 1440),
          by = y + 12 + lane * 160,
          titleLines = wrapEventTitle(event.text, Math.max(0, bw - 20), 3),
          selected = (Array.isArray(event.categories) ? event.categories : [])
            .map((key) => eventCategories.find(([candidate]) => candidate === key))
            .filter(Boolean),
          boxHeight = 143;
        ctx.fillStyle = eventBoxColor(event.categories);
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, boxHeight, 10);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx + 6, by + 5, Math.max(0, bw - 12), boxHeight - 10);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(eventTimeLabel(event, item), bx + 10, by + 25);
        ctx.font = 'bold 24px system-ui, sans-serif';
        titleLines.forEach((titleLine, lineIndex) =>
          ctx.fillText(titleLine, bx + 10, by + 50 + lineIndex * 26)
        );
        if (selected.length) {
          ctx.font = '900 20px "Font Awesome 7 Free"';
          selected.forEach((category, iconIndex) => {
            const glyph = iconGlyph(category[1]);
            if (glyph) ctx.fillText(glyph, bx + 10 + iconIndex * 27, by + boxHeight - 10);
          });
        }
        ctx.restore();
      });
      y += rowH + rowGap;
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#305eaa';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillText(window.AppI18n.lang() === 'en' ? 'Event details' : 'Veranstaltungen', 45, detailStart + 42);
    let detailY = detailStart + detailHeadingHeight;
    eventsByPoi.forEach((events, index) =>
      events.forEach((event, eventIndex) => {
        const start = event.start || event.time || '00:00',
          end = event.end ? `–${event.end}${eventSpan(event).overnight ? ' (+1)' : ''}` : '',
          selected = (Array.isArray(event.categories) ? event.categories : [])
            .map((key) => eventCategories.find(([candidate]) => candidate === key))
            .filter(Boolean);
        ctx.fillStyle = eventBoxColor(event.categories);
        ctx.fillRect(48, detailY - 25, 10, 54);
        ctx.fillStyle = '#26364d';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(
          `${entries[index].name || window.AppI18n.t('locationName')} · ${start}${end}`,
          76,
          detailY
        );
        ctx.font = 'bold 22px system-ui, sans-serif';
        const eventTitle = String(event.text),
          eventTitleWidth = Math.min(ctx.measureText(eventTitle).width, 1450);
        ctx.fillText(eventTitle, 650, detailY, 1450);
        selected.forEach((category, iconIndex) => {
          const centerX = 650 + eventTitleWidth + 18 + iconIndex * 34,
            centerY = detailY - 7;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
          ctx.fillStyle = category[2];
          ctx.fill();
          const glyph = iconGlyph(category[1]);
          if (glyph) {
            ctx.fillStyle = contrastTextColor(category[2]);
            ctx.font = '900 13px "Font Awesome 7 Free"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(glyph, centerX, centerY);
          }
        });
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = 'italic 19px system-ui, sans-serif';
        ctx.fillStyle = '#6c6259';
        descriptionsByPoi[index][eventIndex].forEach((line, lineIndex) =>
          ctx.fillText(line, descriptionX, detailY + 22 + lineIndex * 23)
        );
        detailY += detailRowHeights[index][eventIndex];
      })
    );
    ctx.fillStyle = '#305eaa';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillText(
      window.AppI18n.lang() === 'en' ? 'Category icon key' : 'Kategorien und Symbole',
      45,
      legendStart + 42
    );
    usedCategoryKeys.forEach((key, index) => {
      const category = eventCategories.find(([candidate]) => candidate === key);
      if (!category) return;
      const col = index % 3,
        row = Math.floor(index / 3),
        x = 55 + col * 980,
        baseY = legendStart + legendHeadingHeight + row * legendRowHeight;
      ctx.fillStyle = category[2];
      ctx.beginPath();
      ctx.arc(x + 18, baseY - 9, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = contrastTextColor(category[2]);
      ctx.font = '900 24px "Font Awesome 7 Free"';
      ctx.textAlign = 'center';
      const glyph = iconGlyph(category[1]);
      if (glyph) ctx.fillText(glyph, x + 18, baseY - 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#26364d';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText(categoryLabel(key), x + 58, baseY);
    });
    if (typeof data.qrUrl === 'string' && /^https?:\/\//i.test(data.qrUrl)) {
      const qrSize = 80,
        qr = await renderQrCanvas(data.qrUrl, qrSize),
        qrX = width - 150,
        rowCount = Math.ceil(usedCategoryKeys.length / 3),
        lastCategoryRowY = rowCount
          ? legendStart + legendHeadingHeight + (rowCount - 1) * legendRowHeight
          : height - 140,
        qrY = rowCount ? lastCategoryRowY - 52 : height - 138;
      ctx.fillStyle = '#fff';
      ctx.fillRect(qrX - 8, qrY - 8, 96, 122);
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
      const target = data.qrUrl.replace(/^https?:\/\//i, '');
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#26364d';
      ctx.textAlign = 'center';
      let remaining = target;
      const targetLines = [];
      for (let index = 0; index < 2 && remaining; index++) {
        let length = remaining.length;
        while (
          length > 1 &&
          ctx.measureText(remaining.slice(0, length) + (length < remaining.length ? '…' : '')).width > 132
        )
          length--;
        if (length < remaining.length && index === 0) {
          const slash = remaining.slice(0, length).lastIndexOf('/');
          if (slash > length * 0.65) length = slash + 1;
        }
        let line = remaining.slice(0, length);
        remaining = remaining.slice(length);
        if (remaining && index === 1) {
          while (line && ctx.measureText(line + '…').width > 132) line = line.slice(0, -1);
          line = line.replace(/[\s/?.#&_-]+$/, '') + '…';
          remaining = '';
        }
        targetLines.push(line);
      }
      targetLines.forEach((line, index) => ctx.fillText(line, qrX + 40, qrY + 96 + index * 12, 132));
      ctx.textAlign = 'left';
    }
    downloadJpg(canvas, 'www-' + selectedDay + '.jpg', { quality: 0.96, dpi: printDpi });
  }
  window.addEventListener('image-map-language-change', () => {
    if (!(data.pois || []).length) list.textContent = window.AppI18n.t('noPlaces');
    document.getElementById('poi-search').dispatchEvent(new Event('input'));
    renderTimetable();
  });
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
  function initSoundCloudPlayer(settings) {
    const iframe = document.getElementById('soundcloud-widget'),
      controls = document.querySelector('.soundcloud-controls'),
      toggleButton = document.getElementById('music-toggle'),
      next = document.getElementById('music-next'),
      forward30 = document.getElementById('music-forward-30'),
      volume = document.getElementById('music-volume'),
      status = document.getElementById('music-status');
    if (!iframe || !controls || !toggleButton || !next || !forward30 || !volume || !status) return;
    controls.hidden = settings.soundcloudEnabled === false;
    iframe.hidden = settings.soundcloudEnabled === false;
    if (settings.soundcloudEnabled === false) return;
    let playlistUrl = '';
    try {
      const candidate = new URL(settings.soundcloudPlaylist || '');
      if (
        candidate.protocol === 'https:' &&
        ['soundcloud.com', 'www.soundcloud.com'].includes(candidate.hostname.toLowerCase()) &&
        /^\/[^/]+\/sets\/[^/]+\/?$/.test(candidate.pathname)
      )
        playlistUrl = candidate.origin + candidate.pathname.replace(/\/$/, '');
    } catch (_) {}
    if (!playlistUrl) {
      controls.hidden = true;
      iframe.hidden = true;
      return;
    }
    iframe.dataset.src =
      'https://w.soundcloud.com/player/?url=' +
      encodeURIComponent(playlistUrl) +
      '&color=%23305EAA&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false';
    let widget = null,
      isPlaying = false,
      hasUserPlayed = false,
      loading = false,
      statusMode = 'musicPrompt',
      currentTrackName = '';
    const setStatus = (key) => {
      statusMode = key;
      status.textContent = window.AppI18n.t(key);
      status.removeAttribute('href');
      status.removeAttribute('target');
      status.removeAttribute('rel');
      status.classList.remove('is-track');
    };
    const updateToggle = (playing) => {
      isPlaying = playing;
      const key = playing ? 'musicPause' : 'musicPlay',
        icon = toggleButton.querySelector('i');
      icon.className = 'fa-solid ' + (playing ? 'fa-pause' : 'fa-play');
      toggleButton.setAttribute('aria-label', window.AppI18n.t(key));
      toggleButton.title = window.AppI18n.t(key);
    };
    const showCurrentTrack = (sound) => {
      if (!sound) return '';
      statusMode = 'track';
      const rawTitle = String(sound.title || '');
      const hash = rawTitle.indexOf('#');
      currentTrackName = (hash >= 0 ? rawTitle.slice(hash).trim() : rawTitle) || rawTitle;
      status.textContent = currentTrackName || window.AppI18n.t('musicPrompt');
      status.removeAttribute('href');
      status.classList.remove('is-track');
      try {
        const trackUrl = new URL(sound.permalink_url || '');
        if (trackUrl.protocol === 'https:' && /(^|\.)soundcloud\.com$/i.test(trackUrl.hostname)) {
          status.href = trackUrl.href;
          status.target = '_blank';
          status.rel = 'noopener noreferrer';
          status.classList.add('is-track');
        }
      } catch (_) {}
      return currentTrackName;
    };
    const pickRandomTrack = (keepPlaying, fromNextButton = false) => {
      widget.getSounds((sounds) => {
        if (!Array.isArray(sounds) || !sounds.length) return;
        widget.getCurrentSoundIndex((currentIndex) => {
          let index = Math.floor(Math.random() * sounds.length);
          const current = Number(currentIndex);
          if (
            sounds.length > 1 &&
            Number.isInteger(current) &&
            current >= 0 &&
            current < sounds.length &&
            index === current
          ) {
            const other = Math.floor(Math.random() * (sounds.length - 1));
            index = other >= current ? other + 1 : other;
          }
          widget.skip(index);
          setTimeout(() => {
            if (keepPlaying) widget.play();
            else widget.pause();
            if (hasUserPlayed)
              widget.getCurrentSound((sound) => {
                const title = showCurrentTrack(sound);
                if (fromNextButton) window.trackAppEvent?.('Visitor', 'music_next', title);
              });
          }, 450);
        });
      });
    };
    const initialize = () => {
      if (widget || loading) return;
      if (!window.SC?.Widget) {
        setStatus('musicUnavailable');
        return;
      }
      loading = true;
      setStatus('musicLoading');
      iframe.src = iframe.dataset.src;
      widget = window.SC.Widget(iframe);
      widget.bind(window.SC.Widget.Events.READY, () => {
        loading = false;
        next.disabled = false;
        forward30.disabled = false;
        volume.disabled = false;
        widget.setVolume(Number(volume.value));
        pickRandomTrack(true);
      });
      widget.bind(window.SC.Widget.Events.PLAY, () => {
        updateToggle(true);
        if (hasUserPlayed)
          widget.getCurrentSound((sound) => {
            const title = showCurrentTrack(sound);
            window.trackAppEvent?.('Visitor', 'music_track_played', title);
          });
      });
      widget.bind(window.SC.Widget.Events.PAUSE, () => updateToggle(false));
      widget.bind(window.SC.Widget.Events.FINISH, () => {
        updateToggle(false);
        setStatus('musicPrompt');
      });
      widget.bind(window.SC.Widget.Events.ERROR, () => setStatus('musicUnavailable'));
    };
    updateToggle(false);
    next.disabled = true;
    forward30.disabled = true;
    volume.disabled = true;
    setStatus('musicPrompt');
    toggleButton.addEventListener('click', () => {
      window.trackAppEvent?.('Visitor', isPlaying ? 'music_pause' : 'music_play', currentTrackName);
      if (!widget) {
        hasUserPlayed = true;
        initialize();
        return;
      }
      if (isPlaying) widget.pause();
      else {
        hasUserPlayed = true;
        widget.play();
      }
    });
    next.addEventListener('click', () => {
      if (!widget) return;
      widget.isPaused((paused) => pickRandomTrack(!paused, true));
    });
    forward30.addEventListener('click', () => {
      if (!widget) return;
      window.trackAppEvent?.('Visitor', 'music_skip_forward', '30_seconds');
      widget.getPosition((position) =>
        widget.getDuration((duration) => {
          const current = Number(position) || 0,
            total = Number(duration) || 0,
            target = current + 30000;
          widget.seekTo(total > 0 ? Math.min(target, Math.max(0, total - 500)) : target);
        })
      );
    });
    volume.addEventListener('input', () => widget?.setVolume(Number(volume.value)));
    window.addEventListener('image-map-language-change', () => {
      if (statusMode !== 'track') setStatus(statusMode);
      updateToggle(isPlaying);
    });
  }
})();
