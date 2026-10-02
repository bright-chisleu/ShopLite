// Entry point. For step 1, we just prove ES modules load.

import { startRouter } from './router.js';

document.querySelector('[data-year]').textContent = new Date().getFullYear();

startRouter();