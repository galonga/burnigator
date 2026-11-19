(async function () {
  try {
    const response = await fetch('api.php?action=pinboard-status', { cache: 'no-store' });
    if (!response.ok || !(await response.json()).enabled) return;
  } catch (_) {
    return;
  }
  const main = document.querySelector('main'),
    mapTab = document.getElementById('map-tab'),
    timeTab = document.getElementById('timetable-tab');
  if (!main || !mapTab || !timeTab) return;
  const tab = document.createElement('button');
  tab.id = 'pinboard-tab';
  tab.type = 'button';
  tab.className = 'visitor-tab chip-button';
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-selected', 'false');
  tab.textContent = window.AppI18n.t('pinboardTab');
  mapTab.insertAdjacentElement('afterend', tab);
  const view = document.createElement('section');
  view.id = 'pinboard-view';
  view.className = 'pinboard-view';
  view.setAttribute('role', 'tabpanel');
  view.hidden = true;
  view.innerHTML =
    '<h2></h2><p class="hint"></p><div class="pinboard-auth"></div><form class="pinboard-form" hidden><label><span></span><textarea maxlength="2000" required></textarea></label><button class="button button-primary" type="submit"></button></form><p class="pinboard-status" role="status" aria-live="polite"></p><div class="pinboard-posts"></div>';
  main.appendChild(view);
  const auth = view.querySelector('.pinboard-auth'),
    form = view.querySelector('form'),
    textarea = view.querySelector('textarea'),
    status = view.querySelector('.pinboard-status'),
    postsHost = view.querySelector('.pinboard-posts');
  function translate() {
    view.querySelector('h2').textContent = window.AppI18n.t('pinboardTitle');
    view.querySelector('.hint').textContent = window.AppI18n.t('pinboardIntro');
    view.querySelector('label span').textContent = window.AppI18n.t('pinboardMessage');
    form.querySelector('button').textContent = window.AppI18n.t('pinboardPost');
    tab.textContent = window.AppI18n.t('pinboardTab');
  }
  function cookie(name) {
    const prefix = encodeURIComponent(name) + '=';
    const row = document.cookie.split('; ').find((item) => item.startsWith(prefix));
    return row ? decodeURIComponent(row.slice(prefix.length)) : '';
  }
  let csrfCookie = '';
  let attendee = null;
  async function request(action, body, csrf = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (csrf) headers['X-Event-CSRF'] = cookie(csrfCookie);
    const response = await fetch('api.php?action=' + action, {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify(body || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }
  function showTab(open) {
    const mapView = document.getElementById('map-view'),
      timetable = document.getElementById('timetable-view');
    view.hidden = !open;
    mapView.hidden = open;
    if (open) timetable.hidden = true;
    tab.classList.toggle('active', open);
    tab.setAttribute('aria-selected', String(open));
    mapTab.classList.toggle('active', !open && mapView.hidden === false);
    mapTab.setAttribute('aria-selected', String(!open && mapView.hidden === false));
    timeTab.classList.toggle('active', !open && !mapView.hidden);
    timeTab.setAttribute('aria-selected', String(!open && !mapView.hidden));
  }
  tab.addEventListener('click', () => {
    showTab(true);
    refresh();
  });
  mapTab.addEventListener('click', () => {
    view.hidden = true;
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  timeTab.addEventListener('click', () => {
    view.hidden = true;
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  async function loadAuth() {
    const r = await fetch('api.php?action=event-auth-status', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const result = await r.json();
    csrfCookie = result.csrfCookie || '';
    attendee = result.authenticated ? result : null;
    renderAuth();
    window.dispatchEvent(new Event('burnigator-event-auth-changed'));
  }
  function renderAuth() {
    auth.replaceChildren();
    form.hidden = !attendee;
    if (attendee) {
      const label = document.createElement('span');
      label.className = 'pinboard-author';
      label.append(
        window.AppI18n.t('eventSignedIn') + ' ',
        window.BurnigatorAvatar.create(attendee.pseudonym),
        attendee.pseudonym
      );
      const out = document.createElement('button');
      out.type = 'button';
      out.className = 'button button-outlined';
      out.textContent = window.AppI18n.t('eventSignOut');
      out.onclick = async () => {
        try {
          await request('event-logout', {});
          attendee = null;
          renderAuth();
          window.dispatchEvent(new Event('burnigator-event-auth-changed'));
          await refreshPosts();
        } catch (_) {
          status.textContent = window.AppI18n.t('eventFeatureUnavailable');
        }
      };
      auth.append(label, out);
      return;
    }
    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.maxLength = 100;
    input.required = true;
    input.setAttribute('aria-label', window.AppI18n.t('orderCodeLabel'));
    input.placeholder = window.AppI18n.t('orderCodeLabel');
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'button button-primary';
    button.textContent = window.AppI18n.t('eventSignIn');
    const login = document.createElement('form');
    login.className = 'pinboard-login';
    login.append(input, button);
    login.onsubmit = async (event) => {
      event.preventDefault();
      button.disabled = true;
      try {
        const result = await request('event-auth', { orderCode: input.value });
        attendee = result;
        await loadAuth();
        status.textContent = '';
        await refreshPosts();
      } catch (_) {
        status.textContent = window.AppI18n.t('eventAuthFailed');
      } finally {
        button.disabled = false;
        input.value = '';
      }
    };
    const info = document.createElement('p');
    info.className = 'hint pinboard-unlock-info';
    info.textContent = window.AppI18n.t('pinboardUnlockInfo');
    auth.append(info, login);
  }
  function renderPosts(posts) {
    postsHost.replaceChildren();
    if (!posts.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = window.AppI18n.t('pinboardEmpty');
      postsHost.append(empty);
      return;
    }
    posts.forEach((post) => {
      const article = document.createElement('article');
      article.className = 'pinboard-post';
      if (post.hidden) article.classList.add('is-hidden');
      const head = document.createElement('header');
      const author = document.createElement('strong');
      author.className = 'pinboard-author';
      author.append(window.BurnigatorAvatar.create(post.pseudonym), post.pseudonym);
      const time = document.createElement('time');
      time.dateTime = post.createdAt;
      time.textContent = new Date(post.createdAt.replace(' ', 'T') + 'Z').toLocaleString();
      head.append(author, time);
      const body = document.createElement('p');
      body.textContent = post.body;
      article.append(head, body);
      if (post.own) {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button button-secondary';
        edit.textContent = window.AppI18n.t('pinboardEdit');
        edit.onclick = () => {
          const editor = document.createElement('textarea');
          editor.maxLength = 2000;
          editor.value = post.body;
          const save = document.createElement('button');
          save.type = 'button';
          save.className = 'button button-primary';
          save.textContent = window.AppI18n.t('pinboardSave');
          const cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.className = 'button button-outlined';
          cancel.textContent = window.AppI18n.t('pinboardCancel');
          const controls = document.createElement('div');
          controls.className = 'pinboard-actions';
          controls.append(save, cancel);
          body.replaceWith(editor);
          article.append(controls);
          cancel.onclick = () => refreshPosts();
          save.onclick = async () => {
            try {
              await request('pinboard-update', { id: post.id, body: editor.value });
              await refreshPosts();
            } catch (_) {
              status.textContent = window.AppI18n.t('eventFeatureUnavailable');
            }
          };
        };
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button button-outlined';
        remove.textContent = window.AppI18n.t('pinboardDelete');
        remove.onclick = async () => {
          if (!confirm(window.AppI18n.t('pinboardDeleteConfirm'))) return;
          try {
            await request('pinboard-delete', { id: post.id });
            await refreshPosts();
          } catch (_) {
            status.textContent = window.AppI18n.t('eventFeatureUnavailable');
          }
        };
        const controls = document.createElement('div');
        controls.className = 'pinboard-actions';
        controls.append(edit, remove);
        article.append(controls);
      }
      postsHost.append(article);
    });
  }
  async function refreshPosts() {
    const response = await fetch('api.php?action=pinboard', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('unavailable');
    const result = await response.json();
    renderPosts(result.posts || []);
  }
  async function refresh() {
    try {
      await loadAuth();
      await refreshPosts();
    } catch (_) {
      status.textContent = window.AppI18n.t('eventFeatureUnavailable');
    }
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await request('pinboard-create', { body: textarea.value });
      textarea.value = '';
      status.textContent = window.AppI18n.t('pinboardPosted');
      await refreshPosts();
    } catch (_) {
      status.textContent = window.AppI18n.t('eventFeatureUnavailable');
    }
  };
  window.addEventListener('image-map-language-change', translate);
  translate();
  refresh();
})();
