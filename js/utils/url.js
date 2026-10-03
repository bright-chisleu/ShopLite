/**
 * Helpers for reading and writing the query string.
 * The listing view treats the URL as the source of truth for its state.
 */

/**
 * Read the current query string into a plain object.
 * @returns {Record<string, string>}
 */
export function readQuery() {
  const params = new URLSearchParams(window.location.search);
  const out = {};
  for (const [key, value] of params) out[key] = value;
  return out;
}

/**
 * Update the URL's query string without causing a full render of the
 * router. Uses `replaceState` if `replace` is true, otherwise `pushState`.
 *
 * Passing `null` or `undefined` for a value removes that key.
 *
 * @param {Record<string, string | number | null | undefined>} changes
 * @param {{ replace?: boolean }} [options]
 */
export function setQuery(changes, { replace = false } = {}) {
  const params = new URLSearchParams(window.location.search);

  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  const path = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;

  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
}

/**
 * Read a positive integer from the query, with a default and a minimum.
 */
export function readInt(key, { fallback = 0, min = 0 } = {}) {
  const raw = new URLSearchParams(window.location.search).get(key);
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}