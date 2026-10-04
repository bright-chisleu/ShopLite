import { isValidCardNumber } from './luhn.js';

/**
 * @typedef {{ valid:boolean, message:string }} FieldResult */
/** @typedef {Record<string, FieldResult>} FormResult */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-().]{5,}$/;

const MAX = {
  name: 80,
  email: 120,
  phone: 30,
  address: 120,
  city: 60,
  postcode: 20,
  card: 30,
};

/**
 * Validate a single field by name. Returns { valid, message }.
 *
 * @param {string} name
 * @param {string} rawValue
 * @returns {FieldResult}
 */
export function validateField(name, rawValue) {
  const value = String(rawValue ?? '').trim();

  switch (name) {
    case 'name':
      if (!value) return fail('Please enter your full name.');
      if (value.length < 2) return fail('Name must be at least 2 characters.');
      if (value.length > MAX.name) return fail('Name is too long.');
      return ok();

    case 'email':
      if (!value) return fail('Please enter your email address.');
      if (value.length > MAX.email) return fail('Email is too long.');
      if (!EMAIL_RE.test(value)) return fail('Enter a valid email, e.g. name@example.com.');
      return ok();

    case 'phone':
      if (!value) return fail('Please enter your phone number.');
      if (!PHONE_RE.test(value)) return fail('Enter a valid phone number.');
      return ok();

    case 'address':
      if (!value) return fail('Please enter your street address.');
      if (value.length > MAX.address) return fail('Address is too long.');
      return ok();

    case 'city':
      if (!value) return fail('Please enter your city.');
      if (value.length > MAX.city) return fail('City is too long.');
      return ok();

    case 'postcode':
      if (!value) return fail('Please enter your postcode.');
      if (!/^[A-Za-z0-9][A-Za-z0-9 \-]{2,}$/.test(value))
        return fail('Enter a valid postcode.');
      return ok();

    case 'card': {
      const digits = value.replace(/\D/g, '');
      if (!digits) return fail('Please enter your card number.');
      if (digits.length < 12) return fail('Card number is too short.');
      if (digits.length > 19) return fail('Card number is too long.');
      if (!isValidCardNumber(digits))
        return fail('Card number is invalid. Check the digits and try again.');
      return ok();
    }

    default:
      return ok();
  }
}

/**
 * Validate the whole form. Returns { valid, fields }.
 *
 * @param {Record<string, string>} values
 * @returns {{ valid:boolean, fields:FormResult }}
 */
export function validateForm(values) {
  const fields = {};
  let valid = true;
  for (const name of Object.keys(values)) {
    const result = validateField(name, values[name]);
    fields[name] = result;
    if (!result.valid) valid = false;
  }
  return { valid, fields };
}

function ok() { return { valid: true, message: '' }; }
function fail(message) { return { valid: false, message }; }