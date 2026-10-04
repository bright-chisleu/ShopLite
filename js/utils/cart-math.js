/**
 * Cart arithmetic. All values are integer cents.
 *
 * Rules (from the brief):
 *   - 10% discount when subtotal is OVER $500.00
 *   - $9.99 shipping, free when subtotal is OVER $100.00
 */

export const FREE_SHIPPING_THRESHOLD_CENTS = 10000; // $100.00
export const DISCOUNT_THRESHOLD_CENTS = 50000;      // $500.00
export const SHIPPING_CENTS = 999;                  // $9.99
export const DISCOUNT_RATE = 0.10;

/**
 * @typedef {{ id:number, title:string, price:number, quantity:number, stock?:number }} CartLine */
/** @typedef {{ subtotalCents:number, discountCents:number, shippingCents:number, totalCents:number, itemCount:number }} CartTotals */

/**
 * @param {CartLine[]} lines
 * @returns {CartTotals}
 */
export function computeTotals(lines) {
  const safeLines = Array.isArray(lines) ? lines : [];

  const subtotalCents = safeLines.reduce((sum, line) => {
    const price = Number.isFinite(line.price) ? line.price : 0;
    const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
    return sum + price * qty;
  }, 0);

  const itemCount = safeLines.reduce(
    (sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0),
    0
  );

  const discountCents =
    subtotalCents > DISCOUNT_THRESHOLD_CENTS
      ? Math.round(subtotalCents / 10)
      : 0;

  const shippingCents =
    itemCount === 0
      ? 0
      : subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS
        ? 0
        : SHIPPING_CENTS;

  const totalCents = subtotalCents - discountCents + shippingCents;

  return { subtotalCents, discountCents, shippingCents, totalCents, itemCount };
}