// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Runs public/sw.js against small fakes of the service worker globals. */
const code = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const SCOPE = 'https://site.test/ridewind/';

type FakeRequest = { url: string; method: string; mode: string };
type Handler = (event: unknown) => void;

function load(fetchImpl: (req: FakeRequest | string) => Promise<Response>) {
  const listeners: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (r: FakeRequest | string) => (typeof r === 'string' ? r : r.url);
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      match: async (r: FakeRequest | string) => m.get(keyOf(r))?.clone(),
      put: async (r: FakeRequest | string, res: Response) => void m.set(keyOf(r), res),
      add: async (url: string) => void m.set(url, await fetchImpl(url)),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r: FakeRequest | string) => m.delete(keyOf(r)),
    };
  };
  const caches = { open: async (n: string) => cacheFor(n), keys: async () => [...stores.keys()], delete: async (n: string) => stores.delete(n) };
  const self = {
    registration: { scope: SCOPE },
    location: { origin: 'https://site.test' },
    addEventListener: (type: string, fn: Handler) => (listeners[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', code)(self, caches, fetchImpl);
  const cache = () => stores.get('ridewind-shell-v1') ?? new Map<string, Response>();
  /** Dispatches a fetch event; resolves to the response, or undefined if the worker didn't handle it. */
  const fire = (url: string, opts: Partial<FakeRequest> = {}) => {
    // Cast so TypeScript doesn't narrow this to `undefined`: it's assigned inside the callback.
    let handled = undefined as Promise<Response> | undefined;
    listeners.fetch!({ request: { url, method: 'GET', mode: 'cors', ...opts }, respondWith: (p: Promise<Response>) => (handled = p) });
    return handled;
  };
  return { fire, cache };
}

const ok = (body: string) => Promise.resolve(new Response(body, { status: 200 }));
const offline = () => Promise.reject(new TypeError('Failed to fetch'));

describe('service worker', () => {
  it('leaves map tiles and forecast requests alone', () => {
    const sw = load(() => ok('x'));
    expect(sw.fire('https://tile.openstreetmap.org/1/1/1.png')).toBeUndefined();
    expect(sw.fire('https://api.open-meteo.com/v1/forecast?x=1')).toBeUndefined();
  });

  it('ignores anything that is not a GET', () => {
    const sw = load(() => ok('x'));
    expect(sw.fire(`${SCOPE}samples/a.gpx`, { method: 'POST' })).toBeUndefined();
  });

  it('serves the page from the network, and the saved copy when offline', async () => {
    let online = true;
    const sw = load(() => (online ? ok('<html>v1</html>') : offline()));
    expect(await (await sw.fire(SCOPE, { mode: 'navigate' }))!.text()).toBe('<html>v1</html>');
    online = false;
    expect(await (await sw.fire(`${SCOPE}?x=1`, { mode: 'navigate' }))!.text()).toBe('<html>v1</html>');
  });

  it('serves built assets from the cache once fetched', async () => {
    let online = true;
    const sw = load(() => (online ? ok('js') : offline()));
    await sw.fire(`${SCOPE}assets/index-abc.js`);
    online = false;
    expect(await (await sw.fire(`${SCOPE}assets/index-abc.js`))!.text()).toBe('js');
  });

  it('drops assets a fresh page no longer uses', async () => {
    let page = '<script src="/ridewind/assets/index-old.js"></script>';
    const sw = load((r) => (typeof r !== 'string' && r.mode === 'navigate' ? ok(page) : ok('js')));
    await sw.fire(SCOPE, { mode: 'navigate' });
    await sw.fire(`${SCOPE}assets/index-old.js`);
    expect(sw.cache().has(`${SCOPE}assets/index-old.js`)).toBe(true);
    page = '<script src="/ridewind/assets/index-new.js"></script>';
    await sw.fire(SCOPE, { mode: 'navigate' });
    expect(sw.cache().has(`${SCOPE}assets/index-old.js`)).toBe(false);
  });

  it('falls back to a cached sample route when offline', async () => {
    let online = true;
    const sw = load(() => (online ? ok('<gpx/>') : offline()));
    await sw.fire(`${SCOPE}samples/prs-cw.gpx`);
    online = false;
    expect(await (await sw.fire(`${SCOPE}samples/prs-cw.gpx`))!.text()).toBe('<gpx/>');
  });
});
