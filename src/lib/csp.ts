/**
 * Content Security Policy for the production build, injected as a <meta> tag
 * (GitHub Pages can't send response headers). It allows only this site's own
 * files, Open-Meteo for data, OpenStreetMap for map tiles and the routing
 * server used when drawing a route that follows roads.
 *
 * - No 'unsafe-inline' or 'unsafe-eval': the build has no inline scripts or
 *   styles, and map icons set their rotation through the CSSOM, not style="".
 * - data: images are needed for Leaflet's bundled control icons.
 * - frame-ancestors can't be set from a <meta> tag, so src/lib/framing.ts
 *   checks for a frame at startup and shows a notice instead of the app.
 */
import { DEFAULT_GEOCODE_URL } from './geocode';
import { DEFAULT_ROUTING_URL, routingOrigin } from './routing-config';

/**
 * The policy's directives. The routing and address-search servers' origins
 * are added to connect-src, so drawing along roads and searching can reach them.
 */
export function cspDirectives(routingUrl: string = DEFAULT_ROUTING_URL, geocodeUrl: string = DEFAULT_GEOCODE_URL): Record<string, string[]> {
  const extra = [routingOrigin(routingUrl), routingOrigin(geocodeUrl)].filter((o): o is string => !!o);
  return {
    ...CSP_DIRECTIVES,
    'connect-src': [...CSP_DIRECTIVES['connect-src']!, ...new Set(extra)],
  };
}

/** The fixed directives, before the routing server is added. */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'https://tile.openstreetmap.org'],
  'connect-src': ["'self'", 'https://api.open-meteo.com'],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [],
};

export function contentSecurityPolicy(directives: Record<string, string[]> = cspDirectives()): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}
