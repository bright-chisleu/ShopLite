/**
 * Central application store.
 *
 * - Module-level singleton.
 * - Views call `subscribe(listener)` and receive the current state on
 *   every change. The returned function unsubscribes.
 * - Cart is persisted to localStorage and synced across tabs.
 * - All money is stored as integer cents.
 */

const CART_KEY = 'shoplite.cart.v1';

const listeners = new Set();

/** @typedef {{ id:number, title:string, price:number, thumbnail:string, stock:number, quantity:number }} CartItem */

/** The single source of truth for app state. */
const state = {
  /** @type {CartItem[]} */
  cart: [],
  /** @type {{ item: CartItem, expiresAt: number } | null} */
  pendingUndo: null,
};

// ---------- Persistence ----------

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation — drop anything malformed rather than crash.
    return parsed.filter(
      (it) =>
        it &&
        typeof it.id === 'number' &&
        typeof it.price === 'number' &&
        typeof it.quantity === 'number'
    );
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch {
    // QuotaExceededError or private mode — ignore, the in-memory state still works.
  }
}

// ---------- Subscription ----------

export function subscribe(listener) {
  listeners.add(listener);
  // Immediately deliver current state so views don't need a separate read.
  listener(getState());
  return () => listeners.delete(listener);
}

function notify() {
  const snapshot = getState();
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch (err) {
      console.error('Store listener threw:', err);
    }
  }
}

/** Returns a shallow snapshot of state. Safe to read from views. */
export function getState() {
  return {
    cart: state.cart,
    pendingUndo: state.pendingUndo,
    // Derived values — handy for views, computed once here.
    itemCount: state.cart.reduce((sum, it) => sum + it.quantity, 0),
    subtotalCents: state.cart.reduce((sum, it) => sum + it.price * it.quantity, 0),
  };
}

// ---------- Cart actions ----------

/**
 * Add a product to the cart. If it's already in the cart, quantity is incremented
 * but clamped to the product's stock.
 *
 * @param {{ id:number, title:string, price:number, thumbnail:string, stock:number }} product
 * @param {number} quantity
 */
export function addToCart(product, quantity = 1) {
  const qty = Math.max(1, Math.floor(quantity));
  const stock = Math.max(0, Math.floor(product.stock ?? 0));

  const existing = state.cart.find((it) => it.id === product.id);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, stock || existing.quantity + qty);
  } else {
    state.cart.push({
      id: product.id,
      title: product.title,
      price: product.price, // already in cents if caller passes cents
      thumbnail: product.thumbnail,
      stock,
      quantity: Math.min(qty, stock || qty),
    });
  }

  saveCart();
  notify();
}

/**
 * Set the quantity for a cart line. Passing 0 removes it.
 * Quantity is clamped to [0, stock].
 */
export function updateQuantity(id, quantity) {
  const item = state.cart.find((it) => it.id === id);
  if (!item) return;

  const next = Math.max(0, Math.min(Math.floor(quantity), item.stock));
  if (next === 0) {
    removeFromCart(id);
    return;
  }
  item.quantity = next;
  saveCart();
  notify();
}

/**
 * Remove a line and remember it for 5 seconds so it can be undone.
 */
export function removeFromCart(id) {
  const index = state.cart.findIndex((it) => it.id === id);
  if (index === -1) return;

  const [removed] = state.cart.splice(index, 1);
  state.pendingUndo = {
    item: removed,
    index,
    expiresAt: Date.now() + 5000,
  };

  // Auto-expire the undo window
  const token = state.pendingUndo;
  setTimeout(() => {
    if (state.pendingUndo === token) {
      state.pendingUndo = null;
      notify();
    }
  }, 5000);

  saveCart();
  notify();
}

/** Restore the most recently removed item, if within the 5s window. */
export function undoRemove() {
  const pending = state.pendingUndo;
  if (!pending) return;
  if (Date.now() > pending.expiresAt) {
    state.pendingUndo = null;
    notify();
    return;
  }

  const { item, index } = pending;
  const at = Math.min(index, state.cart.length);
  state.cart.splice(at, 0, item);
  state.pendingUndo = null;

  saveCart();
  notify();
}

export function clearCart() {
  state.cart = [];
  state.pendingUndo = null;
  saveCart();
  notify();
}

// ---------- Cross-tab sync ----------

// The 'storage' event fires in *other* tabs when this one writes.
// Load the new cart and notify so the header badge updates everywhere.
window.addEventListener('storage', (event) => {
  if (event.key !== CART_KEY) return;
  state.cart = loadCart();
  // A cross-tab change shouldn't expose the other tab's pending undo state.
  state.pendingUndo = null;
  notify();
});

// ---------- Init ----------

state.cart = loadCart();