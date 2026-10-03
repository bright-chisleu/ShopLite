export function render(params) {
  const h1 = document.createElement('h1');
  h1.textContent = `Product ${params.id}`;
  h1.tabIndex = -1;
  h1.id = 'page-heading';

  const wrap = document.createElement('section');
  wrap.append(h1);

  return { element: wrap, title: `Product ${params.id} — ShopLite` };
}