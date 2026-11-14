import { describe, expect, it } from 'vitest';
import { isFramed, showFramedNotice } from '../src/lib/framing';

describe('isFramed', () => {
  it('is false when the page is the top window', () => {
    const win = {} as { self: unknown; top: unknown };
    win.self = win;
    win.top = win;
    expect(isFramed(win)).toBe(false);
  });
  it('is true inside a frame', () => {
    expect(isFramed({ self: {}, top: {} })).toBe(true);
  });
  it('is true when the top window cannot be read', () => {
    const win = {
      self: {},
      get top(): unknown {
        throw new Error('blocked');
      },
    };
    expect(isFramed(win)).toBe(true);
  });
});

describe('showFramedNotice', () => {
  it('replaces the page with a notice and a direct link', () => {
    document.body.innerHTML = '<button id="import">Import GPX</button>';
    showFramedNotice(document, 'https://example.test/ridewind/');
    expect(document.getElementById('import')).toBeNull();
    const link = document.querySelector('a')!;
    expect(link.href).toBe('https://example.test/ridewind/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener');
  });
});
