/**
 * Content Security Policy for the production build, injected as a <meta> tag
 * (GitHub Pages can't send response headers). It allows only this site's own
 * files, Open-Meteo for data and OpenStreetMap for map tiles.
 *
 * - No 'unsafe-inline' or 'unsafe-eval': the build has no inline scripts or
 *   styles, and map icons set their rotation through the CSSOM, not style="".
 * - data: images are needed for Leaflet's bundled control icons.
 * - frame-ancestors can't be set from a <meta> tag, so clickjacking protection
 *   would need a host that supports headers.
 */
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

export function contentSecurityPolicy(directives: Record<string, string[]> = CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}
