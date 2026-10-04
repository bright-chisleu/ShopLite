/**
 * Luhn algorithm for card-number validation.
 * https://en.wikipedia.org/wiki/Luhn_algorithm
 *
 * Steps:
 *   1. Strip non-digits.
 *   2. Starting from the rightmost digit, double every second digit.
 *      If doubling produces a two-digit number, subtract 9.
 *   3. Sum all digits.
 *   4. Valid iff sum % 10 === 0.
 *
 * @param {string|number} input
 * @returns {boolean}
 */
export function isValidCardNumber(input) {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;

  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;

    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

/**
 * Format a card number into groups of 4 digits for display.
 * Preserves up to 19 digits.
 *
 * @param {string} value
 * @returns {string}
 */
export function formatCardNumber(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}