import { api } from '../api.js';
import { readQuery, readInt } from '../utils/url.js';
import { formatCents } from '../utils/money.js';

const PAGE_SIZE = 12;

export function render(_params) {
  // Read state from the URL once. Every subsequent change writes back to the URL.
  const query = readQuery();
  const state = {
    q: query.q ?? '',
    category: query.category ?? '',
    sort: query.sort ?? 'default',
    page: readInt('page', { fallback: 1, min: 1 }),
    priceMin: query.priceMin ? Number(query.priceMin) : null,
    priceMax: query.priceMax ? Number(query.priceMax) : null,
  };

  // ----- DOM skeleton -----

  const h1 = document.createElement('h1');
  h1.textContent = 'Products';

  const status = document.createElement('p');
  status.className = 'listing-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const grid = document.createElement('ul');
  grid.className = 'product-grid';
  grid.setAttribute('aria-busy', 'true');
  grid.setAttribute('aria-label', 'Products');

  const section = document.createElement('section');
  section.className = 'listing';
  section.append(h1, status, grid);

  // ----- Data loading -----

  const controller = new AbortController();

  async function load() {
    status.textContent = 'Loading products…';
    grid.setAttribute('aria-busy', 'true');
    renderSkeletons(grid, PAGE_SIZE);

    const skip = (state.page - 1) * PAGE_SIZE;

    try {
      const data = await api.listProducts({
        limit: PAGE_SIZE,
        skip,
        search: state.q,
        category: state.category,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const products = applyClientFilters(data.products ?? [], state);
      renderProducts(grid, products);

      const total = Number.isFinite(data.total) ? data.total : products.length;
      const noun = total === 1 ? 'product' : 'products';
      status.textContent = `${total} ${noun} found.`;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error(err);
      status.textContent = 'Could not load products.';
      renderError(grid);
    } finally {
      grid.setAttribute('aria-busy', 'false');
    }
  }

  // Kick off the fetch — deliberately not awaited; the view returns immediately.
  load();

  return {
    element: section,
    title: 'Products — ShopLite',
    cleanup() {
      controller.abort();
    },
  };
}

// ---------- Filtering ----------

/**
 * Client-side price filter. The API doesn't support arbitrary price ranges,
 * so we filter the current page after fetching.
 */
function applyClientFilters(products, state) {
  let out = products;

  if (state.priceMin !== null) {
    out = out.filter((p) => p.price * 100 >= state.priceMin * 100);
  }
  if (state.priceMax !== null) {
    out = out.filter((p) => p.price * 100 <= state.priceMax * 100);
  }

  return out;
}

// ---------- Rendering ----------

function renderSkeletons(grid, count) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');
    li.className = 'product-card product-card--skeleton';
    li.setAttribute('aria-hidden', 'true');

    const thumb = document.createElement('div');
    thumb.className = 'skeleton skeleton-thumb';

    const line1 = document.createElement('div');
    line1.className = 'skeleton skeleton-line';

    const line2 = document.createElement('div');
    line2.className = 'skeleton skeleton-line skeleton-line--short';

    li.append(thumb, line1, line2);
    frag.append(li);
  }
  grid.replaceChildren(frag);
}

function renderProducts(grid, products) {
  if (products.length === 0) {
    grid.replaceChildren();
    return;
  }

  const frag = document.createDocumentFragment();
  for (const product of products) {
    frag.append(createProductCard(product));
  }
  grid.replaceChildren(frag);
}

function createProductCard(product) {
  const li = document.createElement('li');
  li.className = 'product-card';

  // Image link
  const link = document.createElement('a');
  link.href = `/product/${product.id}`;
  link.setAttribute('data-link', '');
  link.className = 'product-card__link';
  link.setAttribute('aria-label', `View ${product.title}`);

  const img = document.createElement('img');
  img.src = product.thumbnail;
  img.alt = product.title;
  img.width = 300;
  img.height = 300;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'product-card__image';

  link.append(img);

  // Body
  const body = document.createElement('div');
  body.className = 'product-card__body';

  const title = document.createElement('h2');
  title.className = 'product-card__title';
  title.textContent = product.title;

  const meta = document.createElement('p');
  meta.className = 'product-card__meta';
  meta.textContent = `★ ${Number(product.rating ?? 0).toFixed(1)}`;

  const price = document.createElement('p');
  price.className = 'product-card__price';
  // API returns dollars in `price`; convert to cents for consistency.
  price.textContent = formatCents(Math.round(product.price * 100));

  body.append(title, meta, price);

  li.append(link, body);
  return li;
}

function renderError(grid) {
  grid.replaceChildren();

  const li = document.createElement('li');
  li.className = 'product-grid__error';
  li.textContent = 'Failed to load products.';
  grid.append(li);
}