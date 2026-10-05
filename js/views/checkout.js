import { subscribe, getState, clearCart } from '../store.js';
import { formatCents } from '../utils/money.js';
import { computeTotals } from '../utils/cart-math.js';
import { validateField, validateForm } from '../utils/validation.js';
import { formatCardNumber } from '../utils/luhn.js';

const FIELDS = [
  { name: 'name',     label: 'Full name',     type: 'text',  autocomplete: 'name',         inputmode: 'text'  },
  { name: 'email',    label: 'Email',         type: 'email', autocomplete: 'email',        inputmode: 'email' },
  { name: 'phone',    label: 'Phone',         type: 'tel',   autocomplete: 'tel',          inputmode: 'tel'   },
  { name: 'address',  label: 'Street address',type: 'text',  autocomplete: 'street-address', inputmode: 'text'  },
  { name: 'city',     label: 'City',          type: 'text',  autocomplete: 'address-level2', inputmode: 'text'  },
  { name: 'postcode', label: 'Postcode',      type: 'text',  autocomplete: 'postal-code',  inputmode: 'text'  },
  { name: 'card',     label: 'Card number',   type: 'text',  autocomplete: 'cc-number',    inputmode: 'numeric' },
];

const PROCESSING_MS = 1500;

export function render(_params) {
  const section = document.createElement('section');
  section.className = 'checkout';

  const h1 = document.createElement('h1');
  h1.textContent = 'Checkout';

  const container = document.createElement('div');
  container.className = 'checkout__container';

  section.append(h1, container);

  let unsubscribe = null;
  let submittedOrder = null;

  function paint() {
    // After a successful submit, show the confirmation and stop.
    if (submittedOrder) {
      container.replaceChildren(buildConfirmation(submittedOrder));
      return;
    }

    // If the cart is empty AND we haven't just submitted,
    // there's nothing to check out.
    const state = getState();
    if (state.cart.length === 0) {
      container.replaceChildren(buildEmptyNotice());
      return;
    }

    container.replaceChildren(buildForm(state));
  }

  unsubscribe = subscribe(paint);

  return {
    element: section,
    title: 'Checkout — ShopLite',
    cleanup() {
      if (unsubscribe) unsubscribe();
    },
  };

  // ---------- Form ----------

  function buildForm(state) {
    const wrap = document.createElement('div');
    wrap.className = 'checkout__layout';

    const form = document.createElement('form');
    form.className = 'checkout__form';
    form.noValidate = true; // we use the Constraint Validation API manually
    form.setAttribute('novalidate', '');

    const fieldsWrap = document.createElement('div');
    fieldsWrap.className = 'checkout__fields';
    form.append(fieldsWrap);

    // Build each field
    const inputs = {};
    const errors = {};

        for (const field of FIELDS) {
      const group = document.createElement('div');
      const isWide = field.name === 'address' || field.name === 'card';
      group.className = isWide ? 'field field--wide' : 'field';

      const label = document.createElement('label');
      label.htmlFor = `checkout-${field.name}`;
      label.textContent = field.label;

      const input = document.createElement('input');
      input.type = field.type;
      input.id = `checkout-${field.name}`;
      input.name = field.name;
      input.autocomplete = field.autocomplete;
      input.inputMode = field.inputmode;
      input.required = true;
      input.setAttribute('aria-required', 'true');

      if (field.name === 'card') {
        input.addEventListener('input', () => {
          const caretAtEnd = input.selectionStart === input.value.length;
          input.value = formatCardNumber(input.value);
          if (caretAtEnd) {
            input.setSelectionRange(input.value.length, input.value.length);
          }
        });
      }

      const error = document.createElement('p');
      error.className = 'field__error';
      error.id = `checkout-${field.name}-error`;
      error.setAttribute('role', 'alert');
      error.setAttribute('aria-live', 'polite');

      input.setAttribute('aria-describedby', error.id);

      // Validate on blur
      input.addEventListener('blur', () => {
        showFieldResult(field.name, input, error, validateField(field.name, input.value));
      });

      // Clear error on input after first blur (nicer UX)
      input.addEventListener('input', () => {
        if (error.textContent) {
          error.textContent = '';
          input.removeAttribute('aria-invalid');
          input.classList.remove('field__input--invalid');
        }
      });

      group.append(label, input, error);
      fieldsWrap.append(group);
      inputs[field.name] = input;
      errors[field.name] = error;
    }

    // Submit button
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'checkout__submit';
    submit.textContent = 'Place order';
    form.append(submit);

    // Form-level status (for screen readers)
    const formStatus = document.createElement('p');
    formStatus.className = 'checkout__status';
    formStatus.setAttribute('role', 'status');
    formStatus.setAttribute('aria-live', 'polite');
    form.append(formStatus);

    // Submit handler
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmit({ inputs, errors, submit, formStatus });
    });

    // Summary column
    const totals = computeTotals(state.cart);
    const summary = buildSummary(state.cart, totals);

    wrap.append(form, summary);
    return wrap;
  }

  function showFieldResult(name, input, errorEl, result) {
    if (result.valid) {
      errorEl.textContent = '';
      input.removeAttribute('aria-invalid');
      input.classList.remove('field__input--invalid');
    } else {
      errorEl.textContent = result.message;
      input.setAttribute('aria-invalid', 'true');
      input.classList.add('field__input--invalid');
    }
  }

  async function handleSubmit({ inputs, errors, submit, formStatus }) {
    // Collect values
    const values = {};
    for (const field of FIELDS) values[field.name] = inputs[field.name].value;

    // Validate all
    const { valid, fields } = validateForm(values);

    for (const field of FIELDS) {
      showFieldResult(field.name, inputs[field.name], errors[field.name], fields[field.name]);
    }

    if (!valid) {
      // Focus the first invalid input
      const firstInvalid = FIELDS.find((f) => !fields[f.name].valid);
      if (firstInvalid) inputs[firstInvalid.name].focus();

      formStatus.textContent = 'Please fix the errors above and try again.';
      return;
    }

    // Disable while processing
    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = 'Processing…';
    formStatus.textContent = 'Processing your order.';

    await new Promise((resolve) => setTimeout(resolve, PROCESSING_MS));

    // Generate order number and freeze the summary
    const state = getState();
    const totals = computeTotals(state.cart);
    const order = {
      number: generateOrderNumber(),
      placedAt: new Date(),
      lines: state.cart.map((line) => ({ ...line })),
      totals,
    };

    // Clear cart + swap to confirmation
    submittedOrder = order;
    clearCart();
    formStatus.textContent = '';
    paint();

    // Restore button for safety (in case user navigates back with cache)
    submit.disabled = false;
    submit.textContent = label;
  }
}

// ---------- Confirmation ----------

function buildConfirmation(order) {
  const wrap = document.createElement('div');
  wrap.className = 'checkout__confirmation';

  const h2 = document.createElement('h2');
  h2.textContent = 'Order placed';

  const p = document.createElement('p');
  p.textContent = `Thank you. Your order number is ${order.number}.`;

  const summary = document.createElement('div');
  summary.className = 'checkout__confirmation-summary';

  const orderNumber = document.createElement('p');
  orderNumber.className = 'checkout__order-number';
  const orderLabel = document.createElement('strong');
  orderLabel.textContent = 'Order number: ';
  const orderValue = document.createElement('span');
  orderValue.textContent = order.number;
  orderNumber.append(orderLabel, orderValue);

  const list = document.createElement('ul');
  list.className = 'checkout__order-list';
  for (const line of order.lines) {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = `${line.title} × ${line.quantity}`;
    const price = document.createElement('span');
    price.textContent = formatCents(line.price * line.quantity);
    li.append(title, price);
    list.append(li);
  }

  const totals = document.createElement('dl');
  totals.className = 'checkout__order-totals';
  appendRow(totals, 'Subtotal', formatCents(order.totals.subtotalCents));
  if (order.totals.discountCents > 0) {
    appendRow(totals, 'Discount (10%)', `−${formatCents(order.totals.discountCents)}`);
  }
  appendRow(
    totals,
    'Shipping',
    order.totals.shippingCents === 0 ? 'Free' : formatCents(order.totals.shippingCents)
  );
  appendRow(totals, 'Total', formatCents(order.totals.totalCents), 'checkout__order-total-value');

  const link = document.createElement('a');
  link.href = '/';
  link.setAttribute('data-link', '');
  link.className = 'checkout__continue';
  link.textContent = 'Continue shopping';

  summary.append(orderNumber, list, totals);
  wrap.append(h2, p, summary, link);
  return wrap;
}

// ---------- Empty notice ----------

function buildEmptyNotice() {
  const wrap = document.createElement('div');
  wrap.className = 'checkout__empty';

  const h2 = document.createElement('h2');
  h2.textContent = 'Nothing to check out';

  const p = document.createElement('p');
  p.textContent = 'Your cart is empty. Add some products first.';

  const link = document.createElement('a');
  link.href = '/';
  link.setAttribute('data-link', '');
  link.className = 'checkout__continue';
  link.textContent = 'Browse products';

  wrap.append(h2, p, link);
  return wrap;
}

// ---------- Summary (mirrors the cart view) ----------

function buildSummary(lines, totals) {
  const aside = document.createElement('aside');
  aside.className = 'checkout__summary';
  aside.setAttribute('aria-label', 'Order summary');

  const h2 = document.createElement('h2');
  h2.textContent = 'Order summary';

  const itemsCount = document.createElement('p');
  itemsCount.className = 'checkout__summary-count';
  itemsCount.textContent = `${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'}`;

  const dl = document.createElement('dl');
  dl.className = 'checkout__summary-list';
  appendRow(dl, 'Subtotal', formatCents(totals.subtotalCents));
  if (totals.discountCents > 0) {
    appendRow(dl, 'Discount (10%)', `−${formatCents(totals.discountCents)}`);
  }
  appendRow(
    dl,
    'Shipping',
    totals.shippingCents === 0 ? 'Free' : formatCents(totals.shippingCents)
  );
  appendRow(dl, 'Total', formatCents(totals.totalCents), 'checkout__summary-total');

  aside.append(h2, itemsCount, dl);
  return aside;
}

function appendRow(dl, label, value, valueClass = '') {
  const dt = document.createElement('dt');
  dt.textContent = label;

  const dd = document.createElement('dd');
  dd.textContent = value;
  if (valueClass) dd.className = valueClass;

  dl.append(dt, dd);
}

// ---------- Utilities ----------

function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SHL-${timestamp}-${random}`;
}