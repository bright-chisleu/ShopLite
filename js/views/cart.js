import {
  subscribe,
  updateQuantity,
  removeFromCart,
  undoRemove,
  clearCart,
} from '../store.js';
import { formatCents } from '../utils/money.js';
import { computeTotals } from '../utils/cart-math.js';

export function render(_params) {
  const section = document.createElement('section');
  section.className = 'cart';

  const h1 = document.createElement('h1');
  h1.textContent = 'Cart';

  const body = document.createElement('div');
  body.className = 'cart__body';

  const undoBar = document.createElement('div');
  undoBar.className = 'cart__undo';
  undoBar.hidden = true;
  undoBar.setAttribute('role', 'status');
  undoBar.setAttribute('aria-live', 'polite');

  section.append(h1, undoBar, body);

  let unsubscribe = null;

  function paint(state) {
    // Undo bar
    if (state.pendingUndo) {
      undoBar.hidden = false;
      undoBar.replaceChildren(buildUndoBar(state.pendingUndo));
    } else {
      undoBar.hidden = true;
      undoBar.replaceChildren();
    }

    if (state.cart.length === 0) {
      body.replaceChildren(buildEmptyCart());
      return;
    }

    const totals = computeTotals(state.cart);
    body.replaceChildren(
      buildCartLayout(state.cart, totals, {
        onQuantityChange: (id, qty) => updateQuantity(id, qty),
        onRemove: (id) => removeFromCart(id),
        onClear: () => {
          if (confirm('Clear the entire cart?')) clearCart();
        },
      })
    );
  }

  // Subscribe now — delivers the current state synchronously.
  unsubscribe = subscribe(paint);

  return {
    element: section,
    title: 'Cart — ShopLite',
    cleanup() {
      if (unsubscribe) unsubscribe();
    },
  };
}

// ---------- Undo bar ----------

function buildUndoBar(pending) {
  const frag = document.createDocumentFragment();

  const msg = document.createElement('span');
  msg.textContent = `Removed "${pending.item.title}".`;

  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'cart__undo-button';
  undo.textContent = 'Undo';
  undo.addEventListener('click', () => undoRemove());

  frag.append(msg, undo);
  return frag;
}

// ---------- Empty cart ----------

function buildEmptyCart() {
  const wrap = document.createElement('div');
  wrap.className = 'cart__empty';

  const p = document.createElement('p');
  p.textContent = 'Your cart is empty.';

  const link = document.createElement('a');
  link.href = '/';
  link.setAttribute('data-link', '');
  link.className = 'cart__continue';
  link.textContent = 'Continue shopping';

  wrap.append(p, link);
  return wrap;
}

// ---------- Cart layout ----------

function buildCartLayout(lines, totals, handlers) {
  const wrap = document.createElement('div');
  wrap.className = 'cart__layout';

  // Left column: line items
  const listWrap = document.createElement('div');
  listWrap.className = 'cart__list-wrap';

  const list = document.createElement('ul');
  list.className = 'cart__list';
  list.setAttribute('aria-label', 'Cart items');

  const frag = document.createDocumentFragment();
  for (const line of lines) {
    frag.append(buildCartRow(line, handlers));
  }
  list.append(frag);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'cart__clear';
  clear.textContent = 'Clear cart';
  clear.addEventListener('click', handlers.onClear);

  listWrap.append(list, clear);

  // Right column: summary
  const summary = buildSummary(totals);

  wrap.append(listWrap, summary);
  return wrap;
}

function buildCartRow(line, handlers) {
  const li = document.createElement('li');
  li.className = 'cart-row';

  // Image
  const img = document.createElement('img');
  img.src = line.thumbnail;
  img.alt = '';
  img.width = 80;
  img.height = 80;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'cart-row__image';

  // Title
  const info = document.createElement('div');
  info.className = 'cart-row__info';

  const title = document.createElement('h2');
  title.className = 'cart-row__title';

  const titleLink = document.createElement('a');
  titleLink.href = `/product/${line.id}`;
  titleLink.setAttribute('data-link', '');
  titleLink.textContent = line.title;
  title.append(titleLink);

  const unit = document.createElement('p');
  unit.className = 'cart-row__unit';
  unit.textContent = `${formatCents(line.price)} each`;

  info.append(title, unit);

  // Quantity input
  const qtyWrap = document.createElement('div');
  qtyWrap.className = 'cart-row__qty';

  const qtyLabel = document.createElement('label');
  qtyLabel.htmlFor = `qty-${line.id}`;
  qtyLabel.className = 'cart-row__qty-label';
  qtyLabel.textContent = 'Qty';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.id = `qty-${line.id}`;
  qtyInput.name = `qty-${line.id}`;
  qtyInput.min = '1';
  qtyInput.max = String(line.stock > 0 ? line.stock : line.quantity);
  qtyInput.step = '1';
  qtyInput.value = String(line.quantity);
  qtyInput.inputMode = 'numeric';

  qtyInput.addEventListener('change', () => {
    const raw = Number.parseInt(qtyInput.value, 10);
    const max = line.stock > 0 ? line.stock : line.quantity;
    const next = Number.isFinite(raw) ? Math.min(Math.max(1, raw), max) : 1;
    qtyInput.value = String(next);
    handlers.onQuantityChange(line.id, next);
  });

  qtyWrap.append(qtyLabel, qtyInput);

  // Line total
  const lineTotal = document.createElement('p');
  lineTotal.className = 'cart-row__total';
  lineTotal.textContent = formatCents(line.price * line.quantity);

  // Remove
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'cart-row__remove';
  remove.textContent = 'Remove';
  remove.setAttribute(
    'aria-label',
    `Remove ${line.title} from cart`
  );
  remove.addEventListener('click', () => handlers.onRemove(line.id));

  li.append(img, info, qtyWrap, lineTotal, remove);
  return li;
}

// ---------- Summary ----------

function buildSummary(totals) {
  const aside = document.createElement('aside');
  aside.className = 'cart-summary';
  aside.setAttribute('aria-label', 'Order summary');

  const h2 = document.createElement('h2');
  h2.className = 'cart-summary__title';
  h2.textContent = 'Order summary';

  const dl = document.createElement('dl');
  dl.className = 'cart-summary__list';

  appendRow(dl, 'Subtotal', formatCents(totals.subtotalCents));

  if (totals.discountCents > 0) {
    appendRow(
      dl,
      'Discount (10%)',
      `−${formatCents(totals.discountCents)}`,
      'cart-summary__value--discount'
    );
  }

  appendRow(
    dl,
    'Shipping',
    totals.shippingCents === 0
      ? 'Free'
      : formatCents(totals.shippingCents),
    totals.shippingCents === 0 ? 'cart-summary__value--free' : ''
  );

  // Divider
  const divider = document.createElement('div');
  divider.className = 'cart-summary__divider';

  appendRow(
    dl,
    'Total',
    formatCents(totals.totalCents),
    'cart-summary__value--total'
  );

  aside.append(h2, dl, divider);

  // Checkout button
  const checkout = document.createElement('a');
  checkout.href = '/checkout';
  checkout.setAttribute('data-link', '');
  checkout.className = 'cart-summary__checkout';
  checkout.textContent = 'Proceed to checkout';
  aside.append(checkout);

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