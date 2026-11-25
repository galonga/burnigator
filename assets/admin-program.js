// Admin: timetable / program editor (per-place and per-timeline event lists).
// Classic script: create(ctx) is called by admin.js with the shared admin state accessors.
(function () {
  window.BurnigatorAdminProgram = {
    create(ctx) {
      const {
        getData,
        role,
        eventCategories,
        programDays,
        orderedProgramDays,
        newId,
        say,
        userError,
        hasIncompleteEvent,
        hasInvalidEventTime,
        saveProgramEvent,
        refreshHistory,
      } = ctx;
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
        add.disabled = getData().timelines.length >= 3;
        add.onclick = () => {
          window.trackAppEvent?.('Admin', 'independent_timeline_add');
          getData().timelines.push({ id: newId(), name: '', program: normalizeProgram({}) });
          renderTimelines();
          host
            .querySelectorAll('.timeline-name-input')
            .item(getData().timelines.length - 1)
            ?.focus();
        };
        host.appendChild(add);
        getData().timelines.forEach((timeline, index) => {
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
            const previous = getData().timelines;
            getData().timelines = getData().timelines.filter((item) => item.id !== timeline.id);
            renderTimelines();
            if (!(await saveTimelines())) {
              getData().timelines = previous;
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
        if (getData().timelines.length > 3) {
          say(window.AppI18n.t('timelineLimit'), true);
          return false;
        }
        const timeline = getData().timelines.find((item) => item.id === timelineId);
        if (timeline && !String(timeline.name || '').trim()) {
          say(window.AppI18n.t('timelineNameRequired'), true);
          document.querySelector('.independent-timeline-card .timeline-name-input')?.focus();
          return false;
        }
        if (getData().timelines.some((item) => !String(item.name || '').trim())) {
          say(window.AppI18n.t('timelineNameRequired'), true);
          document.querySelector('.independent-timeline-card .timeline-name-input')?.focus();
          return false;
        }
        if (hasIncompleteEvent(getData().timelines)) return false;
        if (hasInvalidEventTime(getData().timelines)) {
          say(window.AppI18n.t('invalidEventTime'), true);
          return false;
        }
        const events = getData().timelines.flatMap((item) => Object.values(item.program || {}).flat());
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
            body: JSON.stringify({
              timelines: getData().timelines,
              expectedUpdatedAt: getData().updatedAt || '',
            }),
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error || window.AppI18n.t('failedSave'));
          getData().updatedAt = result.map.updatedAt;
          getData().timelines = (result.map.timelines || []).map((item) => ({
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
      return { normalizeProgram, buildProgramEditor, renderTimelines, saveTimelines };
    },
  };
})();
