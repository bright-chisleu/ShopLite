# ShopLite
Ecommerce Assessment Project


A small single-page storefront built with plain HTML, CSS, and JavaScript.
Product data comes from the [DummyJSON Products API](https://dummyjson.com/docs/products).
## QA

Test plan, test cases, bug reports, API checks, and a summary are in
the [`qa/`](./qa) folder. Start with [`qa/SUMMARY.md`](./qa/SUMMARY.md).
## Live

- Deployed: https://shoplitemarket.netlify.app
- Repository: https://github.com/bright-chisleu/ShopLite

## Requirements

- Node.js 18 or later (used only to run a local static server)
- A modern browser (Chrome, Firefox, or Safari)

No build step. No package manager dependencies. The application is loaded
directly by the browser using ES modules.

## Running locally

Clone the repository, then serve the folder:

    git clone https://github.com/bright-chisleu/ShopLite.git
    cd shoplite
    npx serve .

Open http://localhost:3000 in a browser.

## Project Structure
```
ShopLite/
├── index.html              App shell
├── _redirects              Netlify SPA fallback
├── serve.json              Local dev SPA fallback for `npx serve`
├── css/
│   ├── tokens.css          Design tokens (colors, spacing, typography)
│   ├── base.css            Reset, layout, typography, breakpoints
│   └── components.css      Component-level styles
├── js/
│   ├── main.js             Entry point — shell wiring and router boot
│   ├── router.js           History API routing and view lifecycle
│   ├── api.js              Fetch wrapper with in-memory cache
│   ├── store.js            Central state, cart, localStorage, cross-tab
│   ├── utils/
│   │   ├── money.js        Integer-cent formatting
│   │   ├── cart-math.js    Subtotal, discount, shipping, total
│   │   ├── luhn.js         Card validation and formatting
│   │   ├── validation.js   Per-field form validation
│   │   ├── url.js          Query string helpers
│   │   └── ui.js           Small UI helpers (flashButton)
│   └── views/
│       ├── listing.js      /              Product grid
│       ├── detail.js       /product/:id    Product detail
│       ├── cart.js         /cart           Cart
│       ├── checkout.js     /checkout       Checkout and confirmation
│       └── notFound.js     404 fallback
└── qa/
    ├── test-plan.md        Scope, risks, environments
    ├── test-cases.md       Scripted test cases
    ├── bug-reports.md      Bugs found and their status
    ├── api-checks.md       Manual API endpoint checks
    └── SUMMARY.md          PM-facing release recommendation
```


# Architecture

## Router

`js/router.js` owns navigation. It matches `location.pathname` against a
routes table, dispatches to a view module, and manages the view lifecycle.

Views export a `render(params)` function that returns:

- `element` — the DOM node to mount
- `title` — the string to assign to `document.title`
- `cleanup` — optional function called before the next view mounts

Views never navigate on their own. Internal links carry a `data-link`
attribute, and the router intercepts their clicks, calling `history.pushState`
and re-rendering. Back and forward are handled by a `popstate` listener.

On every render the router:
1. Calls the previous view's cleanup function.
2. Matches the current pathname to a route (or falls back to 404).
3. Replaces the outlet contents with the new view.
4. Updates `document.title`.
5. Moves focus to the page's `<h1>` so screen readers and keyboards land
   on the new content.

# API layer

`js/api.js` is the only place that calls `fetch`. It:

- Prefixes every path with `https://dummyjson.com`.
- Normalizes failures into an `ApiError` with `status` and `url`.
- Re-throws `AbortError` so callers can silently ignore cancelled requests.
- Caches GET responses in a `Map` for five minutes, keyed by full URL.

The `api` object exposes named methods (`listProducts`, `getProduct`,
`listCategories`) so views don't assemble query strings themselves.

# Store

`js/store.js` is a module-level singleton. It holds the cart, exposes
subscribe/notify, and persists the cart to `localStorage`. State changes
flow in one direction: views call actions (`addToCart`, `updateQuantity`,
`removeFromCart`, `undoRemove`, `clearCart`), the store updates itself,
saves, and notifies every subscriber.

The router's `cleanup` hook is what makes subscription lifecycles safe:
each view subscribes in `render()` and returns an unsubscribe function.

The cart is also synced across tabs: a `storage` event listener reads the
new cart from `localStorage` and notifies subscribers in the current tab.

All money is stored as integer cents.

# View lifecycle

Each view's `render(params)` returns `{ element, title, mounted?, cleanup? }`.

- The router inserts `element` into the outlet.
- If `mounted` is a function, the router calls it **after** insertion.
  This is where a view can query its own DOM (e.g. to populate a select
  or attach an observer).
- If `cleanup` is a function, the router calls it **before** the next
  view mounts. This is where subscriptions are torn down and in-flight
  requests are aborted.

# Listing view

`js/views/listing.js` is the largest view. It reads its entire state from
the URL query string, fetches from the API, and renders a grid of cards.

The query string drives everything:

| Param      | Meaning                                | Example       |
| ---------- | -------------------------------------- | ------------- |
| `q`        | Search term                            | `phone`       |
| `category` | Category slug                          | `smartphones` |
| `sort`     | Composite sort key                     | `price-asc`   |
| `page`     | 1-based page number                    | `2`           |
| `priceMin` | Client-side minimum price, in dollars  | `50`          |
| `priceMax` | Client-side maximum price, in dollars  | `500`         |

The URL is the single source of truth. Every control reads its value
from the URL on mount and writes it back on change via `setQuery`.
Deep-linking works because of this: pasting a URL restores the exact
view.

Two API-related notes:

- Search uses a separate endpoint. DummyJSON exposes
  `/products/search?q=...` and `/products/category/{slug}?limit=...`
  separately. When both a search term and a category are active,
  search wins — the category is dropped from the request.
- **Price is applied client-side.** The API has no server-side price
  filter, so `priceMin`/`priceMax` are applied to the 12 products
  returned for the current page. The UI shows a hint under the price
  field so users understand the scope. This is documented under
  Known issues.

Search input is debounced by 300 ms. A single `AbortController` is
created per render; every new fetch aborts the previous one, so an
older response can never overwrite a newer one. The controller is
aborted in the view's `cleanup()` when the user navigates away.

The view uses the router's `mounted()` hook to populate the category
dropdown after the element is in the DOM. Categories come from
`/products/categories` and are cached by the API layer for five minutes.

Pagination is windowed: for 17 pages with the current page at 8, the
control shows `1 … 6 7 [8] 9 10 … 17`. The window size is 5 and the
edges shift inward so the current page stays visible.

# Known issues

- Price range only filters the current page. The DummyJSON API has no
  server-side price filter, so `priceMin`/`priceMax` are applied after
  fetching 12 products. A product outside the current page that matches
  the price range will not appear until you navigate to its page.
- Category and search share one API call. Combining a search term
  with a category is not supported by DummyJSON — the API exposes
  `/products/search` OR `/products/category/{slug}`, not both. When both
  are set, search wins.
- Total count after client-side price filter is approximate. The
  status line reflects the API's `total`, not the filtered count, when a
  price range is active.
- Price range is client-side and page-scoped. The DummyJSON API has
  no server-side price filter, so `priceMin`/`priceMax` are applied to
  the 12 products returned for the current page. A product outside the
  current page that matches the range will not appear until you navigate
  to its page. The UI shows a hint under the price field and a
  "Showing X of 12 on this page" status to make this clear.
- Search and category cannot be combined. DummyJSON exposes
  `/products/search` and `/products/category/{slug}` as separate
  endpoints. When both a search term and a category are set, search
  wins and the category is ignored in the request. The category
  dropdown still reflects the URL, but the results are unfiltered by
  category.
- Total count in the status line is the API's total, not the filtered
  total. When a price range is active, the status line shows both
  numbers, e.g. "Showing 8 of 12 on this page (price filtered). 1–12 of
  194 products total." The second half reflects the API's total across
  all pages.
- Empty state on page 2+ after a filter change. Applying a price
  filter or changing search terms resets to page 1, so this shouldn't
  happen in normal use. If you deep-link to `?q=zzzzz&page=5`, the
  status will read "No products found" and pagination will be hidden —
  that's correct.
- Undo expires after 5 seconds. Removing an item shows an undo bar
  for five seconds. After that, the item is gone (the store no longer
  retains it). This matches the brief; a longer window would require
  keeping removed items in memory indefinitely.
- clear cart uses the browser's `confirm()`. Not the prettiest UI,
  but accessible and reliable. A custom modal would be nicer but is out
  of scope for the brief.

- Checkout confirmation does not survive a page refresh. After
  placing an order, refreshing `/checkout` shows the "Nothing to check
  out" state (the cart was cleared). The order number is not persisted
  anywhere. In a real app you would store the order server-side and
  navigate to an order confirmation URL.
- Order numbers are client-generated. `SHL-...` strings are
  produced with `Date.now()` and `Math.random()`. They are unique enough
  for a demo but not guaranteed unique and not cryptographically random.
- Checkout confirmation does not survive a page refresh. After
  placing an order, refreshing `/checkout` shows the "Nothing to check
  out" state (the cart was cleared). The order number is not persisted
  anywhere. In a real app you would store the order server-side and
  navigate to an order confirmation URL.
- Undo bar remains interactive on an empty cart. After removing
  the last item, the undo bar stays visible for its 5-second window
  even though the cart is now empty. Documented as BUG-06 in
  `qa/bug-reports.md`.
- Order numbers are client-generated. `SHL-...` strings are
  produced with `Date.now()` and `Math.random()`. They are unique
  enough for a demo but not guaranteed unique and not cryptographically
  random.

  # Key decisions

- URL is the state. All listing state (search, category, sort,
  page, price range) lives in the query string, not in a JS variable
  that shadows it. This is what makes deep links and back/forward
  work. It also means one source of truth — you can't get out of
  sync with the URL because you never maintain parallel state.
- One fetch per render, aborted on cleanup. Every render creates
  a fresh `AbortController`. Navigating away aborts any in-flight
  request. The previous behaviour (each keystroke firing a fetch and
  letting the fastest win) is a classic source of stale-data bugs;
  aborting makes it impossible by construction.
- Money in integer cents. Prices, subtotal, discount, shipping
  and total are all integer cents. Floats are converted for display
  only. This will matter more in the cart step where a 10% discount
  on a subtotal of $500.00 is easy to get wrong by a cent.
- Client-side price filter, clearly labelled. The brief calls for
  a client-side price filter. Rather than pretend it's server-side,
  the UI hints at the scope and the status line reports the filtered
  count against the current page. Being honest about a limitation is
  better than hiding it.
- Router guards against broken views. If a view's `render()`
  throws or returns an object without an `element`, the router logs
  the offending route and renders the 404 view. This turns a
  hard-to-debug blank page into a visible error.
- Custom events for cross-module signalling. When the empty
  state's "Clear filters" button needs to trigger a full re-render,
  the listing view dispatches `shoplite:rerender` instead of
  importing the router (which would create a circular dependency).
  `main.js` is the only module that wires the event to the router.

  # Cart view

`js/views/cart.js` subscribes to the store and repaints on every state
change. Because the store notifies on the `storage` event too, the cart
also updates live when another tab modifies it — no explicit cross-tab
wiring in this view.

All money math lives in `js/utils/cart-math.js`. The cart view and the
checkout view both call `computeTotals()` so the numbers can never
disagree. Rules:

- Subtotal is the sum of `price × quantity` across lines.
- 10% discount applies when subtotal is **over $500.00**.
- Shipping is $9.99, free when subtotal is **over $100.00**.
- Total = subtotal − discount + shipping.

Every value is integer cents; formatting happens only at the edges.

# Checkout

`js/views/checkout.js` renders a form on the left and an order summary
on the right. The summary calls the same `computeTotals()` as the cart,
so the numbers can't drift between views.

Validation lives in `js/utils/validation.js`. Each field has its own
rule:

| Field    | Rule                                                                 |
| -------- | -------------------------------------------------------------------- |
| name     | Non-empty, 2–80 chars                                                |
| email    | Non-empty, matches `something@something.something`                   |
| phone    | Non-empty, starts with a digit or `+`, 6–30 chars of digits/spaces  |
| address  | Non-empty, ≤120 chars                                                |
| city     | Non-empty, ≤60 chars                                                 |
| postcode | Non-empty, alphanumeric with optional spaces/hyphens                 |
| card     | 12–19 digits, passes the Luhn algorithm                              |

The form uses the browser's Constraint Validation API in spirit —
`required` and `aria-required` are set on every input — but disables
native validation (`noValidate`) so we control the messages. Field
errors appear on blur, clear on input, and are announced via
`role="alert"` + `

## Key decisions and trade-offs

### No framework, by design

The brief forbids frameworks, libraries, and bundlers. Every piece of
routing, state, and rendering is hand-rolled. This makes the code
larger than a React equivalent but keeps every dependency visible and
auditable.

### URL is the source of truth

All listing state (search, category, sort, page, price) lives in the
query string. Views read from the URL on mount and write to it on
change. This is what makes deep links and back/forward work. The
trade-off is more code in `setQuery` and `readQuery`, but the
behaviour is consistent everywhere.

### Money in integer cents

Every price, subtotal, discount, shipping charge, and total is an
integer number of cents. Floats are converted for display only. This
eliminates the `0.1 + 0.2 !== 0.3` class of bugs that would otherwise
surface in the cart totals.

### Client-side price filter

The DummyJSON API has no server-side price filter. The brief specifies
a client-side filter, so this matches the requirement. The trade-off
is that the price filter only sees the 12 products on the current
page. The UI hints at this, and the limitation is documented.

### Search vs category

DummyJSON exposes `/products/search` and `/products/category/{slug}`
as separate endpoints. When both a search term and a category are set,
search wins. This is documented in Known Issues.

### In-memory cache in the API layer

GET responses are cached for 5 minutes, keyed by full URL. Revisiting
a product page or a filtered listing does not refetch. The trade-off
is that data can be up to 5 minutes stale. For a demo storefront this
is acceptable; a production app would need explicit invalidation.

### Cross-tab sync via storage event

The cart is written to `localStorage`. Other tabs listen for the
`storage` event and update their in-memory state. This gives free
cross-tab sync without a server. The trade-off is that `storage`
events do not fire in the tab that made the change — that tab already
has the new state in memory.

## Lighthouse

Run on the live URL in Chrome DevTools, mobile emulation, on macOS
Big Sur.

| Category       | Score |
| -------------- | ----- |
| Performance    | 49    |
| Accessibility  | 100   |
| Best Practices | 82    |
| SEO            | 92    |

Accessibility and SEO meet the brief's target of 90+. Performance is
held down by factors outside the app's control:

- **API latency.** Every listing and detail view makes a request to
  `dummyjson.com`. Lighthouse's mobile profile throttles the network
  to Slow 4G, and third-party response time is counted against the
  app's LCP.
- **Image payload.** Product images are served by DummyJSON as PNGs at
  a fixed size. They are lazy-loaded and sized with explicit
  `width`/`height` to prevent layout shift, but the app cannot
  re-encode or resize them.

Both are inherent to using a third-party API without a proxy layer.
In a production build, images would be served from the app's own CDN
in a modern format (WebP or AVIF) at the exact display size, and API
responses would be cached at the edge. Those changes would lift the
score well into the 90s without touching the app code.

Best Practices at 82 is largely driven by third-party cookie flags
from the API host; there are no console errors on the live site.