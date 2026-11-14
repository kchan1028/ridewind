/**
 * Inline validation messages for form fields. Each message sits right after
 * its input, is linked with aria-describedby, and is a polite live region
 * that exists (empty) before any error, so screen readers announce changes.
 */

/** The message element for an input, created empty on first use. */
export function fieldErrorFor(input: HTMLInputElement): HTMLElement {
  const id = `${input.id}-error`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('p');
    el.id = id;
    el.className = 'field-error';
    el.setAttribute('aria-live', 'polite');
    input.insertAdjacentElement('afterend', el);
  }
  return el;
}

/** Shows `message` for the input, or clears it when `message` is null. */
export function setFieldError(input: HTMLInputElement, message: string | null): void {
  const el = fieldErrorFor(input);
  const others = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((t) => t && t !== el.id);
  if (message) {
    if (el.textContent !== message) el.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', [el.id, ...others].join(' '));
    return;
  }
  el.textContent = '';
  input.removeAttribute('aria-invalid');
  if (others.length > 0) input.setAttribute('aria-describedby', others.join(' '));
  else input.removeAttribute('aria-describedby');
}
