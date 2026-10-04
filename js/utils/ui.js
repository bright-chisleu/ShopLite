/**
 * Small UI helpers shared across views.
 */

/**
 * Briefly swap a button's label to signal a successful action.
 * Restores the original text after `duration` ms.
 *
 * @param {HTMLButtonElement} button
 * @param {string} message
 * @param {number} [duration=1200]
 */
export function flashButton(button, message = 'Added!', duration = 1200) {
  if (!button) return;
  if (button.dataset.flashing === 'true') return;

  button.dataset.flashing = 'true';
  const original = button.textContent;
  const originalDisabled = button.disabled;

  button.textContent = message;
  button.disabled = true;

  setTimeout(() => {
    button.textContent = original;
    button.disabled = originalDisabled;
    delete button.dataset.flashing;
  }, duration);
}