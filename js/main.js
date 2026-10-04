import { startRouter, rerender } from './router.js';
import { subscribe } from './store.js';

const yearEl = document.querySelector('[data-year]');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// --- Cart badge + live region ---

const cartCountEl = document.querySelector('[data-cart-count]');
const liveRegionEl = document.querySelector('[data-live-region]');
const cartButtonEl = document.querySelector('.cart-button');

let previousItemCount = null;

subscribe((state) => {
  if (cartCountEl) {
    cartCountEl.textContent = String(state.itemCount);
  }
  if (cartButtonEl) {
    cartButtonEl.setAttribute(
      'aria-label',
      state.itemCount === 1 ? 'Cart, 1 item' : `Cart, ${state.itemCount} items`
    );
  }

  // Only announce *changes*, not the initial hydration.
  if (previousItemCount !== null && state.itemCount !== previousItemCount && liveRegionEl) {
    const diff = state.itemCount - previousItemCount;
    const word = Math.abs(diff) === 1 ? 'item' : 'items';
    const verb = diff > 0 ? 'added' : 'removed';
    liveRegionEl.textContent = `${Math.abs(diff)} ${word} ${verb}. Cart has ${state.itemCount} ${state.itemCount === 1 ? 'item' : 'items'}.`;
  }
  previousItemCount = state.itemCount;
});
// Views can request a full re-render (e.g. after clearing filters
// via replaceState) without importing the router themselves.
window.addEventListener('shoplite:rerender', () => rerender());
// --- Boot ---

startRouter();