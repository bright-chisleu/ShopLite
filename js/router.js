export function startRouter() {
  const outlet = document.querySelector('[data-outlet]');
  outlet.innerHTML = ''; // temporary
  const h1 = document.createElement('h1');
  h1.textContent = 'Router placeholder';
  outlet.append(h1);
}