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

  const pagination = document.createElement('nav');
  pagination.className = 'pagination';
  pagination.setAttribute('aria-label', 'Pagination');
  pagination.hidden = true;

  section.append(h1, form, status, grid, pagination);

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
      state.total = Number.isFinite(data.total) ? data.total : products.length;
      state.totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

      renderProducts(grid, products, state);
      renderPagination(pagination, state, (page) => {
        state.page = page;
        setQuery({ page: page === 1 ? null : String(page) });
        load();
        // Move focus back to the heading so screen readers announce the
        // new page context.
        h1.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      });

            updateStatus(data.products ?? [], state);
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

    // Re-filter from the raw (unfiltered) page data, never from a
    // previously filtered list.
    state._filtering = true;
    const raw = grid._rawProducts ?? [];
    renderProducts(grid, applyClientFilters(raw, state), state);
    state._filtering = false;

    updateStatus(raw, state);
    updatePaginationCounts(raw, state);

    setQuery({
      priceMin: min === null ? null : String(min),
      priceMax: max === null ? null : String(max),
    });
  }

  function handlePriceClear() {
    state.priceMin = null;
    state.priceMax = null;

    state._filtering = true;
    const raw = grid._rawProducts ?? [];
    renderProducts(grid, applyClientFilters(raw, state), state);
    state._filtering = false;

    updateStatus(raw, state);
    updatePaginationCounts(raw, state);

    setQuery({ priceMin: null, priceMax: null });
  }
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

  const hint = document.createElement('p');
  hint.className = 'filter__hint';
  hint.textContent = 'Filters the current page of results.';

  priceWrap.append(priceInputs, priceActions, hint);
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

function renderProducts(grid, products, state) {
  // `products` here may already be filtered by price. Only update the
  // raw cache when the caller passes a fresh, unfiltered list.
  if (!state._filtering) {
    grid._rawProducts = products;
  }

  if (products.length === 0) {
    grid.replaceChildren(buildEmptyState(state));
    return;
  }

  const frag = document.createDocumentFragment();
  for (const product of products) {
    frag.append(createProductCard(product));
  }
  grid.replaceChildren(frag);
}

function updateStatus(rawProducts, state) {
  const status = document.querySelector('.listing-status');
  if (!status) return;

  if (state.total === 0) {
    status.textContent = 'No products found.';
    return;
  }

  const visible = applyClientFilters(rawProducts, state).length;
  const noun = state.total === 1 ? 'product' : 'products';
  const from = (state.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(state.page * PAGE_SIZE, state.total);

  if (state.priceMin !== null || state.priceMax !== null) {
    status.textContent = `Showing ${visible} of ${rawProducts.length} on this page (price filtered). ${from}–${to} of ${state.total} ${noun} total.`;
  } else {
    status.textContent = `Showing ${from}–${to} of ${state.total} ${noun}.`;
  }
}

function updatePaginationCounts(_rawProducts, _state) {
  // Pagination follows the API's `total`, not the client-side filtered
  // count. This stub exists as a single place to hang future refinements
  // (e.g. hiding pages with no visible products).
}

function buildEmptyState(state) {
  const li = document.createElement('li');
  li.className = 'product-grid__empty';

  const h2 = document.createElement('h2');
  h2.className = 'product-grid__empty-title';
  h2.textContent = 'No products found';

  const p = document.createElement('p');
  const hasFilters =
    state.q || state.category || state.priceMin !== null || state.priceMax !== null;
  p.textContent = hasFilters
    ? 'Try adjusting your search or filters.'
    : 'There is nothing to show right now.';

  li.append(h2, p);

  if (hasFilters) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'product-grid__clear';
    clear.textContent = 'Clear filters';
    clear.addEventListener('click', () => {
      // Strip every query param and let the router re-dispatch.
      // The router listens for 'shoplite:rerender' (see main.js).
      window.history.pushState({}, '', window.location.pathname);
      window.dispatchEvent(new CustomEvent('shoplite:rerender'));
    });
  }

  return li;
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
  const li = document.createElement('li');
  li.className = 'product-grid__error';

  const h2 = document.createElement('h2');
  h2.className = 'product-grid__error-title';
  h2.textContent = 'Something went wrong';

  const msg = document.createElement('p');
  msg.textContent = 'We could not load products. Check your connection and try again.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'product-grid__retry';
  btn.textContent = 'Retry';
  btn.addEventListener('click', onRetry);

  li.append(h2, msg, btn);
  grid.replaceChildren(li);
}

// ---------- Pagination ----------

/**
 * Compute the visible page numbers for a paginated list.
 * Returns e.g. [1, '…', 5, 6, 7, '…', 17].
 */
function buildPageWindow(current, total, size = 5) {
  if (total <= size + 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half = Math.floor(size / 2);
  let start = Math.max(2, current - half);
  let end = Math.min(total - 1, current + half);

  // Shift the window if we hit an edge
  if (current - half < 2) {
    end = Math.min(total - 1, size + 1);
  }
  if (current + half > total - 1) {
    start = Math.max(2, total - size);
  }

  const out = [1];
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

function renderPagination(nav, state, onPageChange) {
  if (!state.totalPages || state.totalPages <= 1) {
    nav.hidden = true;
    nav.replaceChildren();
    return;
  }

  nav.hidden = false;
  const frag = document.createDocumentFragment();

  const makeButton = (label, page, { disabled = false, current = false, aria } = {}) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = 'pagination__button';
    if (current) {
      btn.classList.add('pagination__button--current');
      btn.setAttribute('aria-current', 'page');
    }
    if (disabled) btn.disabled = true;
    if (aria) btn.setAttribute('aria-label', aria);
    if (!disabled && !current) {
      btn.addEventListener('click', () => onPageChange(page));
    }
    return btn;
  };

  // Prev
  frag.append(
    makeButton('Previous', state.page - 1, {
      disabled: state.page <= 1,
      aria: 'Previous page',
    })
  );

  // Numbers
  const window = buildPageWindow(state.page, state.totalPages);
  for (const item of window) {
    if (item === '…') {
      const span = document.createElement('span');
      span.className = 'pagination__ellipsis';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = '…';
      frag.append(span);
      continue;
    }
    frag.append(
      makeButton(String(item), item, {
        current: item === state.page,
        aria: `Page ${item}`,
      })
    );
  }

  // Next
  frag.append(
    makeButton('Next', state.page + 1, {
      disabled: state.page >= state.totalPages,
      aria: 'Next page',
    })
  );

  nav.replaceChildren(frag);
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