# ShopLite
Ecommerce Assessment Project


A small single-page storefront built with plain HTML, CSS, and JavaScript.
Product data comes from the [DummyJSON Products API](https://dummyjson.com/docs/products).

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

Project Structure
.
├── index.html              App shell
├── _redirects              Netlify SPA fallback
├── css/
│   ├── tokens.css          Design tokens (colors, spacing, typography)
│   ├── base.css            Reset, layout, typography, breakpoints
│   └── components.css      Component-level styles
├── js/
│   ├── main.js             Entry point
│   ├── router.js           History API routing
│   ├── api.js              Fetch wrapper with caching and abort handling
│   ├── store.js            Central app state, localStorage persistence
│   ├── utils/
│   │   ├── money.js        Integer-cent money helpers
│   │   ├── luhn.js         Card number validation
│   │   └── url.js          Query string parsing and serialization
│   └── views/
│       ├── listing.js      Product listing
│       ├── detail.js       Product detail
│       ├── cart.js         Cart
│       ├── checkout.js     Checkout and confirmation
│       └── notFound.js     404
└── qa/
    ├── test-plan.md        Scope, risks, environments
    ├── test-cases.md       Manual test cases
    ├── bug-reports.md      Bugs found during testing
    └── api-checks.md       Manual API endpoint checks

## Done

- Project scaffold and folder structure
- HTML shell with semantic landmarks and accessibility hooks
- Design tokens and base stylesheet
- History API router with param matching and focus management

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

The remaining architecture (store, API layer, and how views subscribe to
state) is documented as those modules are built.
## Done

- Project scaffold and folder structure
- HTML shell with semantic landmarks and accessibility hooks
- Design tokens and base stylesheet
- History API router with param matching and focus management
- API wrapper with in-memory cache and abort support
- Central store with cart actions and cross-tab sync

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