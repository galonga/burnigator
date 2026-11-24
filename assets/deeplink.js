/*
 * Deep links to events and places: index.php?event=<id> and index.php?poi=<id>.
 * Pure helpers shared by the visitor page and the Node tests (tests/deeplink.test.js).
 */
(function (root) {
  const ID = /^[A-Za-z0-9_-]{1,64}$/;

  function isValidId(id) {
    return typeof id === 'string' && ID.test(id);
  }

  /** The link target of a query string, or null. If both are present the event wins. */
  function parseLink(search) {
    const params = new URLSearchParams(search || '');
    for (const type of ['event', 'poi']) {
      const id = params.get(type);
      if (isValidId(id)) return { type, id };
    }
    return null;
  }

  /** A shareable URL for the current page: same path, only the link parameter, no hash. */
  function buildLink(href, type, id) {
    const url = new URL(href);
    url.search = '';
    url.hash = '';
    url.searchParams.set(type, id);
    return url.toString();
  }

  /** The page URL without the link parameters (other parameters are kept). */
  function stripLink(href) {
    const url = new URL(href);
    url.searchParams.delete('event');
    url.searchParams.delete('poi');
    url.hash = '';
    return url.toString();
  }

  /** Finds an event in places and timelines: { ownerId, ownerName, day, event } or null. */
  function findEvent(data, id) {
    const groups = [
      ...(data?.pois || []).map((item) => ({ item, name: item.name })),
      ...(data?.timelines || []).map((item) => ({ item, name: item.name })),
    ];
    for (const { item, name } of groups) {
      for (const [day, entries] of Object.entries(item.program || {})) {
        if (!Array.isArray(entries)) continue;
        const event = entries.find((entry) => entry && entry.id === id);
        if (event) return { ownerId: item.id, ownerName: name || '', day, event };
      }
    }
    return null;
  }

  const api = { isValidId, parseLink, buildLink, stripLink, findEvent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BurnigatorDeepLink = api;
})(typeof window !== 'undefined' ? window : globalThis);
