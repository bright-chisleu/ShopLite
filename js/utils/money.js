/**
 * Money helpers. All prices in this app are integer cents.
 * Never use floats for money — 0.1 + 0.2 !== 0.3 in IEEE 754.
 */

/**
 * Format an integer number of cents as a USD string.
 * @param {number} cents
 * @returns {string} e.g. 1999 -> "$19.99"
 */
export function formatCents(cents) {
  if (!Number.isFinite(cents)) return '$0.00';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Convert a dollar amount to integer cents.
 * @param {number|string} dollars
 * @returns {number}
 */
export function toCents(dollars) {
  const n = typeof dollars === 'string' ? Number.parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Convert integer cents to a dollar number (for display only — never use
 * the result in further arithmetic).
 */
export function toDollars(cents) {
  return (Number.isFinite(cents) ? cents : 0) / 100;
}