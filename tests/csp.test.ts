import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, cspDirectives, CSP_DIRECTIVES } from '../src/lib/csp';

describe('content security policy', () => {
  const policy = contentSecurityPolicy();

  it('allows only the services the app actually uses', () => {
    expect(CSP_DIRECTIVES['connect-src']).toEqual(["'self'", 'https://api.open-meteo.com']);
    expect(CSP_DIRECTIVES['img-src']).toEqual(["'self'", 'data:', 'https://tile.openstreetmap.org']);
  });

  it('adds the routing server, and only an https one', () => {
    expect(cspDirectives()['connect-src']).toEqual(["'self'", 'https://api.open-meteo.com', 'https://valhalla1.openstreetmap.de', 'https://photon.komoot.io']);
    expect(cspDirectives('https://api.stadiamaps.com/route/v1')['connect-src']).toContain('https://api.stadiamaps.com');
    expect(cspDirectives('http://evil.example/route', 'http://evil.example/search')['connect-src']).toHaveLength(2);
    expect(policy).toContain("connect-src 'self' https://api.open-meteo.com https://valhalla1.openstreetmap.de https://photon.komoot.io");
  });

  it('never allows inline or eval', () => {
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|\*/);
  });

  it('locks down plugins, base URI and form targets', () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  it('serialises directives separated by semicolons', () => {
    expect(policy.startsWith("default-src 'self'; script-src 'self'")).toBe(true);
    expect(policy.endsWith('upgrade-insecure-requests')).toBe(true);
  });
});
