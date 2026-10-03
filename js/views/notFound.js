export function render(_params) {
  const h1 = document.createElement('h1');
  h1.textContent = 'Page not found';
  h1.tabIndex = -1;
  h1.id = 'page-heading';

  const p = document.createElement('p');
  p.textContent = 'The page you are looking for does not exist.';

  const link = document.createElement('a');
  link.href = '/';
  link.textContent = 'Back to home';
  link.setAttribute('data-link', '');

  const wrap = document.createElement('section');
  wrap.append(h1, p, link);

  return { element: wrap, title: 'Not found — ShopLite' };
}