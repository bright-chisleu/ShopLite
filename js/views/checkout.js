export function render(_params) {
  const h1 = document.createElement('h1');
  h1.textContent = 'Checkout';
  h1.tabIndex = -1;
  h1.id = 'page-heading';

  const wrap = document.createElement('section');
  wrap.append(h1);

  return { element: wrap, title: 'Checkout — ShopLite' };
}