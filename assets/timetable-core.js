/*
 * Pure timetable helpers shared by the visitor page and the Node tests (tests/timetable-core.test.js).
 * No DOM access here. Events that end after midnight (end earlier than start) are drawn to midnight
 * and continued on the next day.
 */
(function (root) {
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  function timeMinutes(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match) return 0;
    return Math.max(0, Math.min(1439, Number(match[1]) * 60 + Number(match[2])));
  }

  function eventSpan(event) {
    const start = timeMinutes(event.start || event.time || '00:00');
    if (event.end) {
      const endMinutes = timeMinutes(event.end);
      if (endMinutes < start) return { start, end: 1440, overnight: endMinutes > 0, carryEnd: endMinutes };
      if (endMinutes > start) return { start, end: endMinutes, overnight: false, carryEnd: 0 };
    }
    return { start, end: Math.min(1440, start + 60), overnight: false, carryEnd: 0 };
  }

  function previousDay(day, dayKeys = DAY_KEYS) {
    return dayKeys[(dayKeys.indexOf(day) + dayKeys.length - 1) % dayKeys.length];
  }

  function formatTime(minutes) {
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  }

  function timelineItems(ownerId, program, day, isVisible = () => true, dayKeys = DAY_KEYS) {
    const items = [];
    const collect = (sourceDay, carried) => {
      (Array.isArray(program?.[sourceDay]) ? program[sourceDay] : []).forEach((event) => {
        if (!isVisible(ownerId, sourceDay, event)) return;
        const span = eventSpan(event);
        if (carried) {
          if (span.overnight)
            items.push({
              event,
              day: sourceDay,
              start: 0,
              end: span.carryEnd,
              overnight: false,
              continued: true,
            });
        } else
          items.push({
            event,
            day: sourceDay,
            start: span.start,
            end: span.end,
            overnight: span.overnight,
            continued: false,
          });
      });
    };
    collect(day, false);
    collect(previousDay(day, dayKeys), true);
    return items.sort((a, b) => a.start - b.start);
  }

  function eventTimeLabel(event, item) {
    const range = (event.start || event.time || formatTime(item.start)) + (event.end ? '–' + event.end : '');
    return item.continued ? '← ' + range : item.overnight ? range + ' →' : range;
  }

  const CHANGED_WINDOW_MS = 24 * 60 * 60 * 1000;

  /** True when the event's schedule changed within the last 24 hours (changedAt is set by the server). */
  function isRecentlyChanged(event, nowMs = Date.now(), windowMs = CHANGED_WINDOW_MS) {
    const changed = Date.parse(event?.changedAt || '');
    return Number.isFinite(changed) && nowMs - changed >= -60000 && nowMs - changed < windowMs;
  }

  /**
   * What is running at nowMinutes and what starts next. entries: [{ ..., item }] where item is a
   * timelineItems() result for today. An event that carried over from yesterday counts while it lasts.
   */
  function currentAndUpcoming(entries, nowMinutes, nextLimit = 3) {
    const now = entries.filter((e) => e.item.start <= nowMinutes && nowMinutes < e.item.end);
    now.sort((a, b) => a.item.end - b.item.end || a.item.start - b.item.start);
    const next = entries.filter((e) => e.item.start > nowMinutes);
    next.sort((a, b) => a.item.start - b.item.start);
    return { now, next: next.slice(0, nextLimit) };
  }

  /**
   * Which items overlap in time. items: [{ key, start, end }]. Returns a Map from key to the keys it
   * overlaps with; items that touch (one ends when the other starts) do not clash.
   */
  function findClashes(items) {
    const clashes = new Map();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i],
          b = items[j];
        if (a.key === b.key || !(a.start < b.end && b.start < a.end)) continue;
        if (!clashes.has(a.key)) clashes.set(a.key, []);
        if (!clashes.has(b.key)) clashes.set(b.key, []);
        clashes.get(a.key).push(b.key);
        clashes.get(b.key).push(a.key);
      }
    }
    return clashes;
  }

  const api = {
    DAY_KEYS,
    isRecentlyChanged,
    currentAndUpcoming,
    findClashes,
    timeMinutes,
    eventSpan,
    previousDay,
    formatTime,
    timelineItems,
    eventTimeLabel,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BurnigatorTimetable = api;
})(typeof window !== 'undefined' ? window : globalThis);
