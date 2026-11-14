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
import { DEFAULT_ROUTING_URL, routingOrigin } from './routing-config';

/**
 * The policy's directives. `routingUrl` adds the routing server's origin to
 * connect-src, so drawing a route that follows roads can reach it.
 */
export function cspDirectives(routingUrl: string = DEFAULT_ROUTING_URL): Record<string, string[]> {
  const routing = routingOrigin(routingUrl);
  return {
    ...CSP_DIRECTIVES,
    'connect-src': [...CSP_DIRECTIVES['connect-src']!, ...(routing ? [routing] : [])],
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
