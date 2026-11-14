/**
 * Routing endpoint settings, kept free of `import.meta.env` so the Vite config
 * (which runs in Node) can import them to build the Content Security Policy.
 *
 * The default is the public Valhalla server run by FOSSGIS e.V. It needs no
 * key, allows browser requests (CORS) and is free for low-volume,
 * non-commercial use at no more than one request per second. Any server that
 * speaks the Valhalla /route API can replace it through VITE_ROUTING_URL, for
 * example Stadia Maps (which authenticates browsers by domain, so no key ships
 * in the page) or a self-hosted Valhalla. See docs/routing.md.
 */
export const DEFAULT_ROUTING_URL = 'https://valhalla1.openstreetmap.de/route';
/** FOSSGIS allows at most one request per second; a little margin on top. */
export const DEFAULT_ROUTING_MIN_INTERVAL_MS = 1100;

/** The origin a routing URL needs in the CSP's connect-src, or null if the URL isn't a usable https URL. */
export function routingOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? u.origin : null;
  } catch {
    return null;
  }
}

/** Map credit for the routing server: FOSSGIS asks for a "report a map error" link; others get a plain credit. */
export function routingAttribution(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  const fix = '<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">report a map error</a>';
  const valhalla = '<a href="https://github.com/valhalla/valhalla" target="_blank" rel="noopener">Valhalla</a>';
  if (host.endsWith('openstreetmap.de')) return `Routing ${valhalla} by <a href="https://fossgis.de/" target="_blank" rel="noopener">FOSSGIS</a>, ${fix}`;
  if (host.endsWith('stadiamaps.com')) return `Routing © <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a>, ${fix}`;
  return `Routing ${valhalla}, ${fix}`;
}

/** A short name for the routing service, used in the privacy note. */
export function routingProviderName(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('openstreetmap.de')) return 'the FOSSGIS Valhalla routing server';
    if (host.endsWith('stadiamaps.com')) return 'Stadia Maps';
    return host;
  } catch {
    return 'the routing service';
  }
}
