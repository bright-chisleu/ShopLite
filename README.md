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

    