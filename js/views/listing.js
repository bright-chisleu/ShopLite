import { api } from '../api.js';
import { readQuery, readInt, setQuery } from '../utils/url.js';
import { formatCents } from '../utils/money.js';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS = [
  { value: 'default',     label: 'Default' },
  { value: 'price-asc',   label: 'Price: low to high',  sortBy: 'price',  order: 'asc'  },
  { value: 'price-desc',  label: 'Price: high to low',  sortBy: 'price',  order: 'desc' },
  { value: 'rating-desc', label: 'Rating: high to low', sortBy: 'rating', order: 'desc' },
  { value: 'title-asc',   label: 'Name: A to Z',        sortBy: 'title',  order: 'asc'  },
];

export function render(_params) {
  const query = readQuery();

  const state = {
    q: query.q ?? '',
    category: query.category ?? '',
    sort: query.sort ?? 'default',
    page: readInt('page', { fallback: 1, min: 1 }),
    priceMin: query.priceMin ? Number(query.priceMin) : null,
    priceMax: query.priceMax ? Number(query.priceMax) : null,
  };

  // ----- Section wrapper -----

  const section = document.createElement('section');
  section.className = 'listing';

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

  const form = buildFilterForm(state, {
    onSearchChange: handleSearch,
    onCategoryChange: handleCategory,
    onSortChange: handleSort,
    onPriceApply: handlePriceApply,
    onPriceClear: handlePriceClear,
  });

  section.append(h1, form, status, grid);

  // ----- Data loading -----

  const controller = new AbortController();

  async function load() {
    status.textContent = 'Loading products…';
    grid.setAttribute('aria-busy', 'true');
    renderSkeletons(grid, PAGE_SIZE);

    const skip = (state.page - 1) * PAGE_SIZE;
    const sortOpt = SORT_OPTIONS.find((o) => o.value === state.sort) ?? SORT_OPTIONS[0];

    try {
      const data = await api.listProducts({
        limit: PAGE_SIZE,
        skip,
        search: state.q,
        category: state.category,
        sortBy: sortOpt.sortBy ?? '',
        order: sortOpt.order ?? '',
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
      renderError(grid, () => load());
    } finally {
      grid.setAttribute('aria-busy', 'false');
    }
  }

  // ----- Handlers -----

  function handleSearch(value) {
    state.q = value.trim();
    state.page = 1;
    setQuery({ q: state.q || null, page: null });
    load();
  }

  function handleCategory(value) {
    state.category = value;
    state.page = 1;
    setQuery({ category: state.category || null, page: null });
    load();
  }

  function handleSort(value) {
    state.sort = value;
    state.page = 1;
    setQuery({ sort: value === 'default' ? null : value, page: null });
    load();
  }

  function handlePriceApply(min, max) {
    state.priceMin = min;
    state.priceMax = max;
    // Price filter is client-side, so we don't need to refetch — re-render
    // the current data with the new filter applied.
    const lastProducts = grid._lastProducts ?? [];
    renderProducts(grid, applyClientFilters(lastProducts, state));
    setQuery({
      priceMin: min === null ? null : String(min),
      priceMax: max === null ? null : String(max),
    });
  }

  function handlePriceClear() {
    state.priceMin = null;
    state.priceMax = null;
    const lastProducts = grid._lastProducts ?? [];
    renderProducts(grid, applyClientFilters(lastProducts, state));
    setQuery({ priceMin: null, priceMax: null });
  }

  // Kick off
   // Kick off the product fetch
  load();

  return {
    element: section,
    title: 'Products — ShopLite',
    mounted() {
      // The router has now inserted `section` into the DOM, so the
      // category <select> exists and can be populated from the API.
      hydrateCategories();
    },
    cleanup() {
      controller.abort();
    },
  };
}

// ---------- Filter form ----------

function buildFilterForm(state, handlers) {
  const form = document.createElement('form');
  form.className = 'listing-filters';
  form.setAttribute('role', 'search');
  form.addEventListener('submit', (e) => e.preventDefault());

  // Search
  const searchWrap = document.createElement('div');
  searchWrap.className = 'filter filter--search';

  const searchLabel = document.createElement('label');
  searchLabel.htmlFor = 'filter-search';
  searchLabel.textContent = 'Search';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'filter-search';
  searchInput.name = 'q';
  searchInput.placeholder = 'Search products…';
  searchInput.autocomplete = 'off';
  searchInput.value = state.q;

  let debounceTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handlers.onSearchChange(searchInput.value);
    }, SEARCH_DEBOUNCE_MS);
  });

  searchWrap.append(searchLabel, searchInput);

  // Category
  const catWrap = document.createElement('div');
  catWrap.className = 'filter filter--category';

  const catLabel = document.createElement('label');
  catLabel.htmlFor = 'filter-category';
  catLabel.textContent = 'Category';

  const catSelect = document.createElement('select');
  catSelect.id = 'filter-category';
  catSelect.name = 'category';

  const anyOption = document.createElement('option');
  anyOption.value = '';
  anyOption.textContent = 'All categories';
  catSelect.append(anyOption);

  if (state.category) catSelect.value = state.category;
  catSelect.addEventListener('change', () => handlers.onCategoryChange(catSelect.value));

  catWrap.append(catLabel, catSelect);

  // Sort
  const sortWrap = document.createElement('div');
  sortWrap.className = 'filter filter--sort';

  const sortLabel = document.createElement('label');
  sortLabel.htmlFor = 'filter-sort';
  sortLabel.textContent = 'Sort by';

  const sortSelect = document.createElement('select');
  sortSelect.id = 'filter-sort';
  sortSelect.name = 'sort';
  for (const opt of SORT_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sortSelect.append(o);
  }
  sortSelect.value = state.sort;
  sortSelect.addEventListener('change', () => handlers.onSortChange(sortSelect.value));

  sortWrap.append(sortLabel, sortSelect);

  // Price range
  const priceWrap = document.createElement('fieldset');
  priceWrap.className = 'filter filter--price';
  const legend = document.createElement('legend');
  legend.textContent = 'Price';
  priceWrap.append(legend);

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.min = '0';
  minInput.step = '1';
  minInput.placeholder = 'Min';
  minInput.setAttribute('aria-label', 'Minimum price in dollars');
  if (state.priceMin !== null) minInput.value = String(state.priceMin);

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.min = '0';
  maxInput.step = '1';
  maxInput.placeholder = 'Max';
  maxInput.setAttribute('aria-label', 'Maximum price in dollars');
  if (state.priceMax !== null) maxInput.value = String(state.priceMax);

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    const min = minInput.value === '' ? null : Math.max(0, Number(minInput.value));
    const max = maxInput.value === '' ? null : Math.max(0, Number(maxInput.value));
    if (min !== null && max !== null && min > max) {
      // Swap silently rather than error — cheaper UX for a demo.
      handlers.onPriceApply(max, min);
    } else {
      handlers.onPriceApply(min, max);
    }
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    minInput.value = '';
    maxInput.value = '';
    handlers.onPriceClear();
  });

  const priceInputs = document.createElement('div');
  priceInputs.className = 'filter__row';
  priceInputs.append(minInput, maxInput);

  const priceActions = document.createElement('div');
  priceActions.className = 'filter__row';
  priceActions.append(applyBtn, clearBtn);

  priceWrap.append(priceInputs, priceActions);

  form.append(searchWrap, catWrap, sortWrap, priceWrap);
  return form;
}

// ---------- Product rendering ----------

function applyClientFilters(products, state) {
  let out = products;
  if (state.priceMin !== null) {
    out = out.filter((p) => p.price >= state.priceMin);
  }
  if (state.priceMax !== null) {
    out = out.filter((p) => p.price <= state.priceMax);
  }
  return out;
}

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
  // Cache the raw product list on the grid element so client-side
  // price filtering doesn't need a re-fetch.
  grid._lastProducts = products;

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
  price.textContent = formatCents(Math.round(product.price * 100));

  body.append(title, meta, price);
  li.append(link, body);
  return li;
}

function renderError(grid, onRetry) {
  grid.replaceChildren();
  const li = document.createElement('li');
  li.className = 'product-grid__error';

  const msg = document.createElement('p');
  msg.textContent = 'Failed to load products.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Retry';
  btn.addEventListener('click', onRetry);

  li.append(msg, btn);
  grid.append(li);
}

// ---------- Categories (fetched separately and cached by the API layer) ----------

export async function hydrateCategories() {
  // Called from the router after the listing view mounts. Populates the
  // category dropdown by fetching from the API.
  const select = document.getElementById('filter-category');
  if (!select) return;

  try {
    const data = await api.listCategories();
    const categories = Array.isArray(data) ? data : [];

    const current = select.value;
    const frag = document.createDocumentFragment();

    const anyOption = document.createElement('option');
    anyOption.value = '';
    anyOption.textContent = 'All categories';
    frag.append(anyOption);

    for (const cat of categories) {
      const name = typeof cat === 'string' ? cat : cat.slug ?? cat.name ?? '';
      const label = typeof cat === 'string' ? cat : cat.name ?? cat.slug ?? '';
      if (!name) continue;
      const o = document.createElement('option');
      o.value = name;
      o.textContent = label;
      frag.append(o);
    }

    select.replaceChildren(frag);
    select.value = current;
  } catch (err) {
    console.error('Failed to load categories:', err);
    // Not fatal — leave the select with just "All categories".
  }
}