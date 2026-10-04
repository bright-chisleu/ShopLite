/**
 * History API router.
 *
 * Routes:
 *   /                     listing
 *   /product/:id          detail
 *   /cart                 cart
 *   /checkout             checkout
 *   (anything else)       404
 *
 * Views are modules that export `render(params)` and return
 *   { element, title, cleanup? }
 *
 * The router is the only place that calls history.pushState.
 * Views never navigate on their own — they emit `data-link` anchors
 * or call `navigate()` from this module.
 */

import * as listing  from './views/listing.js';
import * as detail   from './views/detail.js';
import * as cart     from './views/cart.js';
import * as checkout from './views/checkout.js';
import * as notFound from './views/notFound.js';

const routes = [
  { pattern: /^\/$/,                     view: listing,  name: 'listing'  },
  { pattern: /^\/product\/([^/]+)$/,     view: detail,   name: 'detail',  params: ['id'] },
  { pattern: /^\/cart$/,                 view: cart,     name: 'cart'     },
  { pattern: /^\/checkout$/,             view: checkout, name: 'checkout' },
];

let outlet = null;
let currentCleanup = null;

/**
 * Match a pathname against the routes table.
 * Returns { view, params } or null.
 */
function matchRoute(pathname) {
  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (!match) continue;

    const params = {};
    if (route.params) {
      route.params.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });
    }
    return { view: route.view, params };
  }
  return null;
}

/**
 * Render the current location into the outlet.
 * Called by startRouter and by popstate.
 */
function render() {
  if (!outlet) return;

  // 1. Clean up the previous view
  if (typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch (err) {
      console.error('View cleanup failed:', err);
    }
    currentCleanup = null;
  }

  // 2. Match the route
  const match = matchRoute(window.location.pathname);
  const { view, params } = match || { view: notFound, params: {} };

  // 3. Render the view
    // 3. Render the view
  let result;
  try {
    result = view.render(params);
  } catch (err) {
    console.error('View render failed:', err);
    result = notFound.render({});
  }

  // Guard against views that forget to return a result.
  if (!result || !result.element) {
    console.error(
      `View for "${window.location.pathname}" returned an invalid result:`,
      result
    );
    result = notFound.render({});
    result.title = 'Something went wrong — ShopLite';
  }

    // 4. Swap the DOM
  outlet.replaceChildren(result.element);

  // 5. Update title
  document.title = result.title || 'ShopLite';

  // 6. Save cleanup for next time
  if (typeof result.cleanup === 'function') {
    currentCleanup = result.cleanup;
  }

  // 6b. Run the post-mount hook — the view is now in the document,
  //     so it can query its own elements and kick off late work.
  if (typeof result.mounted === 'function') {
    try {
      result.mounted();
    } catch (err) {
      console.error('View mounted hook failed:', err);
    }
  }

  // 7. Move focus to the new page heading
  //    (deferred so it happens after layout)
  const heading = outlet.querySelector('h1, [data-page-heading]');
  if (heading) {
    // Ensure the heading is focusable without adding a tab stop
    if (!heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1');
    }
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

/**
 * Programmatic navigation. Also used by the click handler.
 * Uses pushState so the browser records a history entry.
 */
export function navigate(path, { replace = false } = {}) {
  if (!path) return;

  const current = window.location.pathname + window.location.search;
  if (current === path) return; // no-op on identical navigation

  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  render();
}

/**
 * Re-render the current location without touching the URL.
 * Useful for a view that has mutated query state via replaceState
 * and wants the tree to reflect it.
 */
export function rerender() {
  render();
}
/**
 * Intercept clicks on internal links marked with [data-link].
 * External links, modifier-key clicks, and downloads pass through.
 */
function handleClick(event) {
  // Ignore right-click, middle-click, etc.
  if (event.defaultPrevented) return;
  if (event.button !== 0) return;

  // Let the browser handle new-tab / new-window intents
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const link = event.target.closest('a[data-link]');
  if (!link) return;

  const href = link.getAttribute('href');
  if (!href) return;

  // Only intercept same-origin links
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return;

  // Let the browser handle non-navigational hrefs (mailto:, tel:, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.preventDefault();
  const path = url.pathname + url.search + url.hash;
  navigate(path);
}

/**
 * Handle back / forward button.
 */
function handlePopState() {
  render();
}

/**
 * Boot the router. Called once from main.js.
 */
export function startRouter() {
  outlet = document.querySelector('[data-outlet]');
  if (!outlet) {
    console.error('Router: [data-outlet] not found in the document.');
    return;
  }

  document.addEventListener('click', handleClick);
  window.addEventListener('popstate', handlePopState);

  // First paint
  render();
}