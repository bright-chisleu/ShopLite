import { api, ApiError } from '../api.js';
import { addToCart } from '../store.js';
import { formatCents } from '../utils/money.js';
import { flashButton } from '../utils/ui.js';

const RELATED_LIMIT = 4;

export function render(params) {
  const productId = params.id;

  const section = document.createElement('section');
  section.className = 'detail';

  const back = document.createElement('a');
  back.href = '/';
  back.setAttribute('data-link', '');
  back.className = 'detail__back';
  back.textContent = '← Back to products';

  const article = document.createElement('article');
  article.className = 'detail__body';
  article.setAttribute('aria-busy', 'true');

  const status = document.createElement('p');
  status.className = 'detail__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const related = document.createElement('section');
  related.className = 'detail__related';
  related.hidden = true;

  section.append(back, status, article, related);

  const controller = new AbortController();

  async function load() {
    status.textContent = 'Loading product…';

    try {
      const product = await api.getProduct(productId, { signal: controller.signal });
      if (controller.signal.aborted) return;

      renderProduct(article, product);
      document.title = `${product.title} — ShopLite`;

      status.textContent = '';
      article.setAttribute('aria-busy', 'false');

      // Related products — same category, exclude current.
      loadRelated(product);
    } catch (err) {
      if (err && err.name === 'AbortError') return;

      if (err instanceof ApiError && err.status === 404) {
        renderNotFound(article, productId);
        status.textContent = '';
        return;
      }

      console.error(err);
      status.textContent = 'Could not load this product.';
      renderErrorState(article, () => load());
    }
  }

  async function loadRelated(product) {
    if (!product.category) return;

    try {
      const data = await api.listProducts({
        category: product.category,
        limit: RELATED_LIMIT + 1, // +1 in case the current product is in the list
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const items = (data.products ?? [])
        .filter((p) => p.id !== product.id)
        .slice(0, RELATED_LIMIT);

      if (items.length === 0) return;

      renderRelated(related, items, product.title);
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('Failed to load related products:', err);
      // Non-fatal — silently skip the related row.
    }
  }

  load();

  return {
    element: section,
    title: 'Product — ShopLite',
    cleanup() {
      controller.abort();
    },
  };
}

// ---------- Product rendering ----------

function renderProduct(container, product) {
  const h1 = document.createElement('h1');
  h1.className = 'detail__title';
  h1.textContent = product.title;

  const layout = document.createElement('div');
  layout.className = 'detail__layout';

  const gallery = buildGallery(product);
  const info = buildInfo(product);

  layout.append(gallery, info);
  container.replaceChildren(h1, layout);
}

function buildGallery(product) {
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.thumbnail];

  const wrap = document.createElement('div');
  wrap.className = 'gallery';

  // Main image
  const main = document.createElement('div');
  main.className = 'gallery__main';

  const mainImg = document.createElement('img');
  mainImg.src = images[0];
  mainImg.alt = product.title;
  mainImg.width = 600;
  mainImg.height = 600;
  mainImg.loading = 'eager';
  mainImg.decoding = 'async';
  mainImg.className = 'gallery__image';
  main.append(mainImg);

  // Thumbnails
  const thumbs = document.createElement('ul');
  thumbs.className = 'gallery__thumbs';
  thumbs.setAttribute('role', 'tablist');
  thumbs.setAttribute('aria-label', 'Product images');

  let index = 0;

  const setIndex = (next) => {
    const clamped = (next + images.length) % images.length;
    index = clamped;
    mainImg.src = images[index];
    updateThumbs();
  };

  const thumbEls = images.map((src, i) => {
    const li = document.createElement('li');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery__thumb';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', `Image ${i + 1} of ${images.length}`);
    btn.setAttribute('aria-selected', 'false');

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.width = 80;
    img.height = 80;
    img.loading = 'lazy';
    img.decoding = 'async';

    btn.append(img);
    btn.addEventListener('click', () => setIndex(i));

    li.append(btn);
    thumbs.append(li);
    return btn;
  });

  function updateThumbs() {
    thumbEls.forEach((btn, i) => {
      btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
      btn.classList.toggle('gallery__thumb--active', i === index);
    });
  }

  updateThumbs();

  // Keyboard: Left/Right arrow on the whole gallery region.
  wrap.setAttribute('tabindex', '0');
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setIndex(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setIndex(index + 1);
    }
  });

  wrap.append(main, thumbs);
  return wrap;
}

function buildInfo(product) {
  const info = document.createElement('div');
  info.className = 'detail__info';

  // Brand
  if (product.brand) {
    const brand = document.createElement('p');
    brand.className = 'detail__brand';
    brand.textContent = product.brand;
    info.append(brand);
  }

  // Rating + stock line
  const meta = document.createElement('p');
  meta.className = 'detail__meta';
  const rating = Number(product.rating ?? 0).toFixed(1);
  const stock = Number(product.stock ?? 0);
  meta.textContent = `★ ${rating} · ${stock > 0 ? `${stock} in stock` : 'Out of stock'}`;
  info.append(meta);

  // Price block: price, discount, original if discounted
  const priceRow = document.createElement('div');
  priceRow.className = 'detail__price-row';

  const priceCents = Math.round(product.price * 100);
  const price = document.createElement('span');
  price.className = 'detail__price';
  price.textContent = formatCents(priceCents);

  priceRow.append(price);

  if (product.discountPercentage && product.discountPercentage > 0) {
    const originalCents = Math.round(
      (product.price / (1 - product.discountPercentage / 100)) * 100
    );
    const original = document.createElement('span');
    original.className = 'detail__price-original';
    original.textContent = formatCents(originalCents);

    const badge = document.createElement('span');
    badge.className = 'detail__discount';
    badge.textContent = `−${Math.round(product.discountPercentage)}%`;

    priceRow.append(original, badge);
  }

  info.append(priceRow);

  // Description
  const description = document.createElement('p');
  description.className = 'detail__description';
  description.textContent = product.description ?? '';
  info.append(description);

  // Quantity + add-to-cart form
  const form = document.createElement('form');
  form.className = 'detail__form';
  form.addEventListener('submit', (e) => e.preventDefault());

  const qtyLabel = document.createElement('label');
  qtyLabel.htmlFor = 'detail-qty';
  qtyLabel.textContent = 'Quantity';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.id = 'detail-qty';
  qtyInput.name = 'quantity';
  qtyInput.min = '1';
  qtyInput.max = String(Math.max(1, stock));
  qtyInput.step = '1';
  qtyInput.value = '1';
  qtyInput.disabled = stock <= 0;
  qtyInput.addEventListener('blur', () => {
    const v = Number.parseInt(qtyInput.value, 10);
    if (!Number.isFinite(v) || v < 1) qtyInput.value = '1';
    else if (v > stock) qtyInput.value = String(stock);
  });

  const qtyWrap = document.createElement('div');
  qtyWrap.className = 'detail__qty';
  qtyWrap.append(qtyLabel, qtyInput);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'detail__add';
  addBtn.textContent = stock > 0 ? 'Add to cart' : 'Out of stock';
  addBtn.disabled = stock <= 0;
  addBtn.addEventListener('click', () => {
    const qty = Math.min(
      Math.max(1, Number.parseInt(qtyInput.value, 10) || 1),
      stock
    );
    addToCart(
      {
        id: product.id,
        title: product.title,
        price: priceCents,
        thumbnail: product.thumbnail,
        stock,
      },
      qty
    );
    flashButton(addBtn, 'Added!');
  });

  form.append(qtyWrap, addBtn);
  info.append(form);

  return info;
}

// ---------- Related ----------

function renderRelated(container, items, parentTitle) {
  const h2 = document.createElement('h2');
  h2.className = 'detail__related-title';
  h2.textContent = 'Related products';

  const list = document.createElement('ul');
  list.className = 'related-list';

  const frag = document.createDocumentFragment();
  for (const product of items) {
    frag.append(buildRelatedCard(product));
  }
  list.append(frag);

  container.replaceChildren(h2, list);
  container.hidden = false;
  container.setAttribute('aria-label', `Products related to ${parentTitle}`);
}

function buildRelatedCard(product) {
  const li = document.createElement('li');
  li.className = 'related-card';

  const link = document.createElement('a');
  link.href = `/product/${product.id}`;
  link.setAttribute('data-link', '');
  link.className = 'related-card__link';
  link.setAttribute('aria-label', `View ${product.title}`);

  const img = document.createElement('img');
  img.src = product.thumbnail;
  img.alt = product.title;
  img.width = 200;
  img.height = 200;
  img.loading = 'lazy';
  img.decoding = 'async';

  link.append(img);

  const title = document.createElement('h3');
  title.className = 'related-card__title';
  title.textContent = product.title;

  const price = document.createElement('p');
  price.className = 'related-card__price';
  price.textContent = formatCents(Math.round(product.price * 100));

  li.append(link, title, price);
  return li;
}

// ---------- Error states ----------

function renderNotFound(container, productId) {
  const wrap = document.createElement('div');
  wrap.className = 'detail__notfound';

  const h1 = document.createElement('h1');
  h1.textContent = 'Product not found';

  const p = document.createElement('p');
  p.textContent = `We could not find a product with id ${productId}.`;

  const link = document.createElement('a');
  link.href = '/';
  link.setAttribute('data-link', '');
  link.className = 'detail__back';
  link.textContent = 'Back to products';

  wrap.append(h1, p, link);
  container.replaceChildren(wrap);
}

function renderErrorState(container, onRetry) {
  const wrap = document.createElement('div');
  wrap.className = 'detail__error';

  const h2 = document.createElement('h2');
  h2.textContent = 'Something went wrong';

  const p = document.createElement('p');
  p.textContent = 'We could not load this product. Check your connection and try again.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'detail__retry';
  btn.textContent = 'Retry';
  btn.addEventListener('click', onRetry);

  wrap.append(h2, p, btn);
  container.replaceChildren(wrap);
}