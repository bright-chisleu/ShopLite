/**
 * Thin fetch wrapper for the DummyJSON Products API.
 *
 * - Prefixes every path with the base URL.
 * - Parses JSON and normalizes errors.
 * - Honors AbortSignal (abort errors are re-thrown with name 'AbortError').
 * - Caches GET responses in memory for CACHE_TTL_MS.
 */

const BASE_URL = 'https://dummyjson.com';
const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { data: any, timestamp: number }>} */
const cache = new Map();

/**
 * API error with the HTTP status attached, so callers can branch on it.
 */
export class ApiError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

/**
 * Perform a GET request against the API.
 *
 * @param {string} path      e.g. "/products?limit=12&skip=0"
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.cache=true]  set false to bypass the in-memory cache
 * @returns {Promise<any>}
 */
export async function get(path, { signal, cache: useCache = true } = {}) {
  const url = path.startsWith('http') ? path : BASE_URL + path;

  // Serve from cache when possible
  if (useCache) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.timestamp < CACHE_TTL_MS) {
      return hit.data;
    }
  }

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (err) {
    // AbortController aborts arrive here as a DOMException named 'AbortError'.
    // Re-throw so callers can check err.name and ignore them.
    if (err && err.name === 'AbortError') throw err;
    // Network-level failures (offline, DNS, CORS)
    throw new ApiError('Network request failed', 0, url);
  }

  if (!response.ok) {
    // Try to read a JSON error body; fall back to the status text.
    let message = response.statusText || `Request failed`;
    try {
      const body = await response.json();
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      // ignore — keep the default message
    }
    throw new ApiError(message, response.status, url);
  }

  const data = await response.json();

  if (useCache) {
    cache.set(url, { data, timestamp: Date.now() });
  }

  return data;
}

/**
 * Clears the in-memory cache. Useful for testing and for a
 * "retry" button that wants a fresh fetch.
 */
export function clearCache() {
  cache.clear();
}

/**
 * Convenience methods for the specific endpoints we use.
 * Keeps the calling code free of query-string assembly.
 */
export const api = {
  listProducts({ limit = 12, skip = 0, search = '', category = '', signal } = {}) {
    if (search) {
      const q = new URLSearchParams({ q: search, limit: String(limit), skip: String(skip) });
      return get(`/products/search?${q}`, { signal });
    }
    if (category) {
      const q = new URLSearchParams({ limit: String(limit), skip: String(skip) });
      return get(`/products/category/${encodeURIComponent(category)}?${q}`, { signal });
    }
    const q = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    return get(`/products?${q}`, { signal });
  },

  getProduct(id, { signal } = {}) {
    return get(`/products/${encodeURIComponent(id)}`, { signal });
  },

  listCategories({ signal } = {}) {
    return get('/products/categories', { signal });
  },
};