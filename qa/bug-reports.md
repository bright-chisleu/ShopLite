# Bug Reports — ShopLite

Bugs found during development and QA testing. Status values:

- **Fixed** — the fix has been committed; commit hash noted.
- **Known** — not fixed; listed in the project README's Known Issues
  section.

## BUG-01: View with a missing return blanks the entire page

- **Severity:** High
- **Priority:** P1
- **Environment:** Firefox 157.0, macOS Big Sur, MacBook Air 2014
- **Status:** Fixed — commit `fix(router): guard against views that
  return no element`

**Steps to reproduce:**

1. Introduce a syntax error or delete the `return { ... }` block from
   `js/views/listing.js`.
2. Reload any page.
3. The page renders header and footer but the main content area is
   empty.

**Expected:** A helpful error is shown; the app does not blank out.

**Actual:** `render()` in the router received `undefined` from the
view and threw an uncaught `TypeError` on `result.element`. The user
sees a blank screen with no explanation.

**Root cause:** The router did not validate the shape of what views
returned.

**Fix:** The router now checks that `result` has an `element`
property. If not, it logs the offending route and renders the 404
view instead.

## BUG-02: "Clear filters" button created but never displayed

- **Severity:** Medium
- **Priority:** P2
- **Environment:** Firefox 157.0, macOS Big Sur, MacBook Air 2014
- **Status:** Fixed — commit `fix(listing): restore render return,
  append clear button, guard router`

**Steps to reproduce:**

1. On `/`, type a search term that returns no results (e.g.
   `zzzzzzzz`).
2. Observe the empty state.

**Expected:** A "Clear filters" button is shown below the message.

**Actual:** The empty state message shows, but no button appears.

**Root cause:** `buildEmptyState()` created the button element but did
not append it to the container. The element existed only in memory and
was discarded when the function returned.

**Fix:** Added `li.append(clear)` before returning the container.

## BUG-03: Price "Clear" retains the current page number

- **Severity:** Medium
- **Priority:** P2
- **Environment:** Firefox 157.0, macOS Big Sur, MacBook Air 2014
- **Status:** Fixed — commit `fix(listing): reset page on price filter,
  ensure clear button renders`

**Steps to reproduce:**

1. On `/`, navigate to page 3.
2. Set `priceMin = 50` and `priceMax = 100`, click Apply.
3. Click Clear.

**Expected:** After clearing, the user is on page 1 of the unfiltered
list.

**Actual:** The page stays at 3. The user sees page 3 of unfiltered
results while expecting page 1.

**Root cause:** `handlePriceClear` reset the price fields but not
`state.page`. Every other filter handler (`handleSearch`,
`handleCategory`, `handleSort`) resets page to 1. This one was missed.

**Fix:** Both price handlers now set `state.page = 1` and write
`page: null` to the URL.

## BUG-04: Duplicate `const stock` declaration crashes the detail view

- **Severity:** High
- **Priority:** P1
- **Environment:** Firefox 157.0, macOS Big Sur, MacBook Air 2014
- **Status:** Fixed — commit `fix(detail): remove duplicate stock
  declaration and h1 handling`

**Steps to reproduce:**

1. Navigate to any `/product/:id`.

**Expected:** Product page renders.

**Actual:** Nothing renders. Console shows `Uncaught SyntaxError:
redeclaration of const stock detail.js:272:9`.

**Root cause:** In `buildInfo` (detail view), `stock` was declared
twice in the same function scope — once for the meta line
("in stock"), once for the quantity input's `max` attribute.

**Fix:** Removed the second declaration. The first `stock` is used
throughout the function.

## BUG-05: Layout shift when product images load on the listing

- **Severity:** Low
- **Priority:** P3
- **Environment:** Firefox 157.0, macOS Big Sur, MacBook Air 2014,
  Network throttled to Slow 3G
- **Status:** Fixed — commit `feat(listing): render product grid with
  skeleton loaders`

**Steps to reproduce:**

1. Load `/` on a slow connection.
2. Watch the grid as images load.

**Expected:** No layout shift; each card keeps the same size
throughout loading.

**Actual:** Cards briefly render smaller and then grow when the image
arrives. Visible on the first page load before caching kicks in.

**Root cause:** The `<img>` element had no intrinsic dimensions set,
so the browser could not reserve space before the image arrived.

**Fix:** Images now include `width="300" height="300"` attributes and
the container uses `aspect-ratio: 1 / 1`.

## BUG-06: Undo bar remains interactive on an empty cart

- **Severity:** Low
- **Priority:** P3
- **Environment:** Safari 16.6.1, macOS Big Sur, MacBook Air 2014
- **Status:** Known

**Steps to reproduce:**

1. Add exactly one item to the cart.
2. Open `/cart`.
3. Click Remove.
4. Observe the empty cart state with the undo bar still visible.

**Expected:** The undo bar could visually indicate the cart is empty,
or its Undo button could be more clearly labelled.

**Actual:** The undo bar reads 'Removed "<item>".' with an Undo button.
The button works correctly — clicking it restores the item. But a user
reading "Your cart is empty" alongside an Undo button can find it
confusing.

**Root cause:** By design, undo remains available for 5 seconds after
a removal, regardless of the resulting cart state. Not a functional
defect, but a UX quirk.

**Status:** Known. Listed in the project README's Known Issues section.

## Summary

| ID     | Severity | Priority | Status |
| ------ | -------- | -------- | ------ |
| BUG-01 | High     | P1       | Fixed  |
| BUG-02 | Medium   | P2       | Fixed  |
| BUG-03 | Medium   | P2       | Fixed  |
| BUG-04 | High     | P1       | Fixed  |
| BUG-05 | Low      | P3       | Fixed  |
| BUG-06 | Low      | P3       | Known  |

Four bugs were found and fixed during development; two were logged
retroactively after a QA pass. All Severity 1 and 2 bugs are resolved.
One Severity 3 known issue is documented in the README.