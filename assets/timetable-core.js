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

  const api = { DAY_KEYS, timeMinutes, eventSpan, previousDay, formatTime, timelineItems, eventTimeLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BurnigatorTimetable = api;
})(typeof window !== 'undefined' ? window : globalThis);
