# Test Cases — ShopLite

Environment for all cases: Firefox 157 and Safari 16.6.1 on macOS
Big Sur, MacBook Air 2014. Dev server: `npx serve . -s` at
localhost:3000. Live URL also tested.

Cart is cleared before each case unless the preconditions say
otherwise.

| ID    | Title                              | Preconditions                          | Steps                                                                 | Test data                                                                    | Expected                                                                                                     | Actual |
| ----- | ---------------------------------- | -------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| TC-01 | Search updates grid after debounce | Listing page loaded                    | 1. Type `phone` in the search box. 2. Wait 1 s without typing.        | Query: `phone`                                                               | After ~300 ms, URL is `?q=phone`, grid shows phone products, one network request.                            | Pass   |
| TC-02 | Rapid typing cancels stale reqs    | DevTools Network throttled to Slow 3G  | 1. Type `ph`. 2. Within 200 ms, clear and type `laptop`.              | Queries: `ph`, then `laptop`                                                 | `/search?q=ph` is cancelled in the Network tab; grid shows laptop results, not phone results.                | Pass   |
| TC-03 | Empty search returns empty state   | Listing page loaded                    | 1. Type `zzzzzzzz`. 2. Wait 1 s.                                      | Query: `zzzzzzzz`                                                            | "No products found" panel with "Clear filters" button. Status reads "No products found."                     | Pass   |
| TC-04 | Subtotal exactly $100.00           | Cart empty                             | 1. Add item price $100.00 qty 1. 2. Open `/cart`.                     | Item price: 10000 cents                                                      | Subtotal $100.00, Shipping $9.99, Total $109.99. No discount.                                                | Pass   |
| TC-05 | Subtotal exactly $500.00           | Cart empty                             | 1. Add item price $500.00 qty 1. 2. Open `/cart`.                     | Item price: 50000 cents                                                      | Subtotal $500.00, no discount row, Shipping Free, Total $500.00.                                             | Pass   |
| TC-06 | Subtotal $500.01                   | Cart empty                             | 1. Add item price $500.01 qty 1. 2. Open `/cart`.                     | Item price: 50001 cents                                                      | Subtotal $500.01, Discount −$50.00, Shipping Free, Total $450.01.                                            | Pass   |
| TC-07 | Subtotal $499.99                   | Cart empty                             | 1. Add item price $499.99 qty 1. 2. Open `/cart`.                     | Item price: 49999 cents                                                      | Subtotal $499.99, no discount, Shipping Free, Total $499.99.                                                 | Pass   |
| TC-08 | Quantity change updates totals     | Cart has one $549.00 item, qty 1       | 1. Change quantity to 2. 2. Blur the field.                           | Quantity: 2                                                                  | Subtotal $1098.00, Discount −$109.80, Shipping Free, Total $988.20. Badge shows 2.                           | Pass   |
| TC-09 | Remove item with undo within 5 s   | Cart has one item                      | 1. Click Remove. 2. Within 5 s, click Undo.                           | —                                                                            | Item reappears in the same position. Totals restore.                                                         | Pass   |
| TC-10 | Undo expires after 5 s             | Cart has one item                      | 1. Click Remove. 2. Wait 6 s. 3. Attempt to undo (no button present). | —                                                                            | Undo bar disappears after 5 s; item is permanently removed.                                                  | Pass   |
| TC-11 | Invalid email rejected             | Checkout form, cart has items          | 1. Enter `not-an-email` in Email. 2. Tab out.                         | Email: `not-an-email`                                                        | Inline error "Enter a valid email, e.g. name@example.com." Input has `aria-invalid=true`.                    | Pass   |
| TC-12 | Card failing Luhn is rejected      | Checkout form, all other fields valid  | 1. Enter `4242 4242 4242 4241`. 2. Tab out. 3. Click Place order.     | Card: 4242 4242 4242 4241                                                    | Inline error "Card number is invalid. Check the digits and try again." Submit blocked; focus moves to card.  | Pass   |
| TC-13 | Card passing Luhn accepted         | Checkout form, all other fields valid  | 1. Enter `4242 4242 4242 4242`. 2. Tab out. 3. Click Place order.     | Card: 4242 4242 4242 4242                                                    | No error. Button disables for ~1.5 s ("Processing…"). Confirmation shown with order number.                  | Pass   |
| TC-14 | Quantity above stock is clamped    | Detail page for product with stock 34  | 1. Enter `99` in quantity. 2. Tab out.                                | Quantity input: 99, stock: 34                                                | Input clamps to `34`. Add to cart adds 34 units.                                                             | Pass   |
| TC-15 | Deep link to non-existent product  | None                                   | 1. Navigate directly to `/product/999999`.                            | URL: /product/999999                                                         | "Product not found" panel with "Back to products" link. No console error.                                    | Pass   |
| TC-16 | Deep-link refresh on listing       | None                                   | 1. Navigate to `/?q=phone&category=smartphones&sort=price-asc&page=2`.| URL as shown                                                                 | Same view as when the URL was composed. Search box has "phone", category selected, sort applied, page 2.     | Pass   |
| TC-17 | Back button navigates history      | On listing page with filters applied   | 1. Search `phone`. 2. Category `smartphones`. 3. Press Back twice.    | —                                                                            | Back once → returns to search-only. Back again → returns to unfiltered.                                      | Pass   |
| TC-18 | Cross-tab cart sync                | Cart has items. Two tabs at `/cart`    | 1. In Tab A, change quantity.                                         | Quantity change in Tab A                                                     | Tab B's cart view updates within 1 s. Badge in Tab B updates too.                                            | Pass   |
| TC-19 | Empty cart on checkout page        | Cart empty                             | 1. Navigate to `/checkout`.                                           | —                                                                            | "Nothing to check out" panel with a "Browse products" link.                                                  | Pass   |
| TC-20 | Quantity zero clamps to one        | Detail page for in-stock product       | 1. Enter `0` in quantity. 2. Tab out.                                 | Quantity input: 0                                                            | Input clamps to `1`.                                                                                         | Pass   |

## Notes on specific cases

- **TC-04 and TC-05** test the exact-boundary conditions the brief
  specifies ("over $100.00" and "over $500.00"). Both pass with no
  discount / shipping charged at exactly the threshold.
- **TC-06 and TC-07** test one cent either side of the $500.00
  boundary.
- **TC-12** uses the failing Luhn number from the brief
  (`4242 4242 4242 4241`).
- **TC-16** verifies the "URL is state" requirement — the same view
  is restored on reload.
- **TC-18** required opening two browser windows side by side. The
  `storage` event fired within ~200 ms in Firefox and ~400 ms in
  Safari.

## How to run the boundary cases (TC-04 to TC-07)

The cart is driven by the store. Seed it from the browser console:

```js
const store = await import('/js/store.js');
store.clearCart();
store.addToCart(
  { id: 999, title: 'Boundary test', price: 10000, stock: 10, thumbnail: '' },
  1
);
// then open /cart