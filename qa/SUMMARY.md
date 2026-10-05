# ShopLite — QA Summary

## What I tested

I tested the four routes end-to-end on Firefox 157 (Gecko) and Safari
16.6.1 (WebKit) on macOS Big Sur, plus mobile viewports at 375×667
(iPhone SE) in both browsers' responsive design modes. Twenty scripted
test cases cover search, filters, sorting, pagination, cart math,
checkout validation, routing, and cross-tab sync. I also ran
exploratory passes on accessibility (keyboard-only walkthrough,
VoiceOver) and layout behaviour under throttled network conditions.

## What I found

Six bugs, all documented in `bug-reports.md`. Five are fixed:

- **BUG-01** — a broken view could blank the entire app with no
  message. Fixed by adding a router guard that falls back to the 404
  view and logs the offending route.
- **BUG-02** — the "Clear filters" button was created but never
  displayed. Fixed by appending it to the container.
- **BUG-03** — clearing the price filter left the user on the wrong
  page. Fixed by resetting pagination on any filter change.
- **BUG-04** — a duplicate variable declaration crashed the detail
  view with a SyntaxError. Fixed by removing the duplicate.
- **BUG-05** — product images caused visible layout shift on slow
  connections. Fixed by setting explicit dimensions.

One known limitation remains:

- **BUG-06** — the undo bar stays visible for 5 seconds after removing
  the last item from the cart. This is a UX quirk, not a defect, and
  it matches the brief's "undo a removal within 5 seconds"
  requirement.

Two additional product limitations are documented in the project
README:

- Price filter is client-side and page-scoped (matches the brief's
  wording, but not an ideal long-term UX).
- Search and category cannot be combined — DummyJSON exposes them as
  separate endpoints.

## Boundary testing

The cart math is verified at the exact boundaries the brief calls
out:

- Subtotal **$100.00** → shipping is still $9.99 (rule says "over
  $100.00").
- Subtotal **$100.01** → shipping free.
- Subtotal **$500.00** → no discount (rule says "over $500.00").
- Subtotal **$500.01** → 10% discount applied.

Every value is computed in integer cents to avoid float drift.

## Would I release?

**Yes, with the known limitations disclosed.**

The core shopping flow is solid. Money math is correct at every
boundary. Search race conditions are prevented by aborting stale
requests. Cart persistence and cross-tab sync work. Checkout
validation — including the Luhn check — behaves correctly on both
positive and negative cases. Deep links and refresh work on the live
URL.

The two remaining limitations are honest trade-offs rather than
defects:

- The price filter is client-side, so it only sees the current page.
  This matches the brief's explicit instruction but would be the first
  thing to change for production.
- Search + category cannot be combined due to the shape of the API.

Neither blocks a release for a demo storefront. Both are documented
so users and stakeholders know what to expect.

If this were going to production, I would prioritise the following:

1. Server-side price filtering (requires an API change).
2. Server-side search within a category (requires an API change).
3. Persist completed orders so `/checkout` can show a receipt after
   refresh.
4. Real card tokenisation (Stripe or similar) instead of a Luhn-only
   check.
5. Automated regression suite for the cart math and Luhn check, so
   future refactors don't silently break the boundary rules.