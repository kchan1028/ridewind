import { beforeEach, describe, expect, it } from 'vitest';
import { fieldErrorFor, setFieldError } from '../src/ui/field-error';

describe('setFieldError', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    document.body.innerHTML = '<div class="field"><label for="speed">Speed</label><input id="speed" aria-describedby="speed-hint" /><p id="speed-hint">Hint</p></div>';
    input = document.getElementById('speed') as HTMLInputElement;
  });

  it('creates one empty live region right after the input', () => {
    const el = fieldErrorFor(input);
    expect(fieldErrorFor(input)).toBe(el);
    expect(input.nextElementSibling).toBe(el);
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.textContent).toBe('');
  });

  it('shows the message, marks the input invalid and links the message first', () => {
    setFieldError(input, 'Enter a speed from 5 to 60 km/h. Still using 25 km/h.');
    expect(fieldErrorFor(input).textContent).toBe('Enter a speed from 5 to 60 km/h. Still using 25 km/h.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('speed-error speed-hint');
  });

  it('does not repeat its id when the error is set twice', () => {
    setFieldError(input, 'First');
    setFieldError(input, 'Second');
    expect(input.getAttribute('aria-describedby')).toBe('speed-error speed-hint');
  });

  it('clears the message and restores the original description', () => {
    setFieldError(input, 'Out of range');
    setFieldError(input, null);
    expect(fieldErrorFor(input).textContent).toBe('');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe('speed-hint');
  });

  it('removes aria-describedby when nothing else described the input', () => {
    input.removeAttribute('aria-describedby');
    setFieldError(input, 'Out of range');
    setFieldError(input, null);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });
});
