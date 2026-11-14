/**
 * Drag or keyboard handle between the side panel and the map on wide screens.
 * The chosen width is kept in localStorage; without one, CSS sizes the panel
 * to the window (see `--panel-width` in styles.css).
 */

const KEY = 'ridewind:panel-width:v1';
const MIN = 360;
const STEP = 32;
/** The map keeps at least this share of the layout. */
const MAX_SHARE = 0.65;

export function initPanelResize(layout: HTMLElement, panel: HTMLElement, handle: HTMLElement): void {
  const wide = window.matchMedia('(min-width: 900px)');
  const maxWidth = () => Math.max(MIN, Math.round(layout.clientWidth * MAX_SHARE));
  const clamp = (w: number) => Math.min(maxWidth(), Math.max(MIN, Math.round(w)));

  const sync = () => {
    handle.setAttribute('aria-valuemin', String(MIN));
    handle.setAttribute('aria-valuemax', String(maxWidth()));
    handle.setAttribute('aria-valuenow', String(Math.round(panel.getBoundingClientRect().width)));
  };

  const apply = (w: number | null, persist: boolean) => {
    if (w === null) layout.style.removeProperty('--panel-width');
    else layout.style.setProperty('--panel-width', `${clamp(w)}px`);
    if (persist) {
      try {
        if (w === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, String(clamp(w)));
      } catch {
        // Storage blocked: the width still applies for this visit.
      }
    }
    sync();
  };

  let saved: number | null = null;
  try {
    const n = Number(localStorage.getItem(KEY));
    if (Number.isFinite(n) && n >= MIN) saved = n;
  } catch {
    // Storage blocked: fall back to the CSS default.
  }
  if (saved !== null) apply(saved, false);

  handle.addEventListener('pointerdown', (ev) => {
    if (!wide.matches || ev.button !== 0) return;
    ev.preventDefault();
    handle.setPointerCapture(ev.pointerId);
    document.body.classList.add('is-resizing');
    const left = layout.getBoundingClientRect().left;
    const move = (e: PointerEvent) => apply(e.clientX - left, false);
    const end = (e: PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      document.body.classList.remove('is-resizing');
      apply(e.clientX - left, true);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });

  // Double-click goes back to the automatic width.
  handle.addEventListener('dblclick', () => apply(null, true));

  handle.addEventListener('keydown', (ev) => {
    const current = panel.getBoundingClientRect().width;
    const step = ev.shiftKey ? STEP * 4 : STEP;
    let next: number | null;
    if (ev.key === 'ArrowLeft') next = current - step;
    else if (ev.key === 'ArrowRight') next = current + step;
    else if (ev.key === 'Home') next = MIN;
    else if (ev.key === 'End') next = maxWidth();
    else if (ev.key === 'Enter') next = null;
    else return;
    ev.preventDefault();
    apply(next, true);
  });

  // Keep a saved width inside the limits when the window shrinks.
  window.addEventListener('resize', () => {
    const w = layout.style.getPropertyValue('--panel-width');
    if (w) apply(parseFloat(w), false);
    else sync();
  });
  sync();
}
