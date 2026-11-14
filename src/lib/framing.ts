/**
 * True when the page is shown inside another site's frame. GitHub Pages can't
 * send the header that blocks framing, so the app checks for itself.
 * If the browser won't let us read the top window, we treat that as framed.
 */
export function isFramed(win: { self: unknown; top: unknown }): boolean {
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

/** Replaces the page with a short notice and a link that opens RideWind on its own. */
export function showFramedNotice(doc: Document, url: string): void {
  const box = doc.createElement('main');
  box.className = 'framed-notice';
  const head = doc.createElement('h1');
  head.textContent = 'RideWind is open inside another site';
  const text = doc.createElement('p');
  text.textContent = 'To keep your routes safe, RideWind only works when you open it directly.';
  const link = doc.createElement('a');
  link.className = 'btn btn-primary';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Open RideWind';
  box.append(head, text, link);
  doc.body.replaceChildren(box);
}
