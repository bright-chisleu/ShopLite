# Test Plan — ShopLite

## 1. Scope

### In scope

- Routing: `/`, `/product/:id`, `/cart`, `/checkout`, 404. Deep-link
  refresh, browser back/forward, shared URLs.
- Product listing: search (debounced), category filter, price range,
  sort, pagination. URL-as-state. Skeleton, empty, and error states.
- Product detail: image gallery with keyboard navigation, quantity
  clamped to stock, add to cart, related products row, 404 handling.
- Cart: quantity changes, remove with 5-second undo, integer-cent math
  for subtotal, discount, shipping, and total. Cross-tab sync.
- Checkout: field validation on blur and submit, Luhn card check,
  processing state, order confirmation, cart clearing.
- Accessibility: keyboard-only navigation, focus on route change,
  `aria-live` announcements for cart updates, form error association.
- Persistence: cart survives refresh and syncs across tabs.
- Performance and layout: no layout shift on image load, Lighthouse
  Performance and Accessibility on mobile emulation.

### Out of scope

- Real payment processing. The checkout is a simulation.
- Real user accounts, authentication, order history.
- Backend behaviour of DummyJSON beyond the endpoints documented in
  `api-checks.md`.
- Server-side rendering, SEO, and social meta tags.
- Load or concurrency testing.

## 2. Risk areas (tested first)

Ranked by severity × likelihood.

1. **Cart totals math.** Money in the wrong unit, off-by-one-cent
   rounding, or a boundary condition on the discount/shipping rules
   would produce incorrect charges. Highest business impact. The brief
   sets specific boundaries (> $500 for discount, > $100 for free
   shipping) that must be tested exactly at the boundary.
2. **Search race conditions.** Rapid typing with a slow network can
   produce out-of-order responses that overwrite fresh results with
   stale ones. Mitigated by AbortController, but worth verifying under
   throttled network conditions.
3. **Checkout validation.** Luhn false positives would let invalid
   cards through; false negatives would block valid ones. Email and
   phone validation are common sources of user frustration when too
   strict.
4. **Deep-link refresh.** Client-side routing breaks on refresh unless
   the host serves `index.html` for unknown paths. A regression here
   breaks shared links — the brief calls this out explicitly.
5. **Cross-tab cart sync.** The `storage` event only fires in other
   tabs. Easy to miss; breaks a stated requirement.
6. **Focus management on route change.** Screen-reader users can lose
   context without an announcement. Easy to regress.
7. **Pagination + filter interaction.** A page number that exceeds the
   result set produces an empty grid with no explanation.
8. **Quantity clamping.** A user typing "99" into a stock-5 field
   should see 5, not 99.

## 3. Test environments

| Environment | Browser / mode                  | Version | OS            | Device                     |
| ----------- | ------------------------------- | ------- | ------------- | -------------------------- |
| Desktop 1   | Firefox                         | 157.0   | macOS Big Sur | MacBook Air 2014           |
| Desktop 2   | Safari                          | 16.6.1  | macOS Big Sur | MacBook Air 2014           |
| Mobile 1    | Safari Responsive Design Mode   | 16.6.1  | macOS Big Sur | iPhone SE (375×667, DPR 2) |
| Mobile 2    | Firefox Responsive Design Mode  | 157.0   | macOS Big Sur | iPhone SE (375×667, DPR 2) |

Firefox (Gecko) and Safari (WebKit) represent two independent
rendering engines. Mobile coverage is emulation only — no real device
was tested. Emulation does not exercise iOS-specific scroll physics
or font hinting; layout, tap-target size, and media query behaviour
are the focus.

## 4. Approach

- Manual exploratory testing followed by scripted test cases.
- Boundary cases explicitly targeted: $100.00, $500.00, $100.01,
  $500.01, stock = 0, stock = 1, quantity = stock + 1, quantity = 0,
  quantity negative, empty search, non-existent product id.
- Negative cases verified for each user-facing action.
- Each scripted case recorded in `test-cases.md`.
- Bugs logged in `bug-reports.md` with severity, priority, and
  reproduction steps.

## 5. Entry and exit criteria

**Entry:** app deployed and running on the live URL; all routes
reachable; console free of errors on initial load.

**Exit:** all scripted test cases executed; no open Severity 1 or 2
bugs; known limitations documented in the project README.

## 6. Limitations

- Single tester. No independent review.
- No real-device testing — mobile coverage is emulation only.
- Test data comes from a public API that changes without notice; some
  cases may drift if DummyJSON updates its product set.