import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors';
import { parseGpx } from '../src/lib/gpx';

const wrap = (inner: string, ns = 'xmlns="http://www.topografix.com/GPX/1/1"') =>
  `<?xml version="1.0"?><gpx version="1.1" creator="test" ${ns}>${inner}</gpx>`;

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return undefined;
}

describe('parseGpx', () => {
  it('reads track points with elevation and the track name', () => {
    const r = parseGpx(
      wrap(`<trk><name>Morning loop</name><trkseg>
        <trkpt lat="52.0" lon="5.0"><ele>10.5</ele><time>2024-01-01T08:00:00Z</time></trkpt>
        <trkpt lat="52.01" lon="5.01"><ele>12</ele></trkpt>
      </trkseg></trk>`),
    );
    expect(r.name).toBe('Morning loop');
    expect(r.source).toBe('track');
    expect(r.points).toEqual([
      { lat: 52, lon: 5, ele: 10.5 },
      { lat: 52.01, lon: 5.01, ele: 12 },
    ]);
  });

  it('falls back to route points and keeps missing elevation as null (not 0)', () => {
    const r = parseGpx(wrap(`<rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte>`), 'fallback');
    expect(r.source).toBe('route');
    expect(r.name).toBe('fallback');
    expect(r.points.every((p) => p.ele === null)).toBe(true);
  });

  it('prefers metadata name and concatenates multiple segments in order', () => {
    const r = parseGpx(
      wrap(`<metadata><name>Meta</name></metadata><trk><name>Trk</name>
        <trkseg><trkpt lat="0" lon="0"/><trkpt lat="0" lon="0.01"/></trkseg>
        <trkseg><trkpt lat="0" lon="0.02"/></trkseg></trk>`),
    );
    expect(r.name).toBe('Meta');
    expect(r.points.map((p) => p.lon)).toEqual([0, 0.01, 0.02]);
  });

  it('parses GPX 1.0 and un-namespaced files', () => {
    const v10 = parseGpx(wrap(`<trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk>`, 'xmlns="http://www.topografix.com/GPX/1/0"'));
    const none = parseGpx(wrap(`<trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk>`, ''));
    expect(v10.points).toHaveLength(2);
    expect(none.points).toHaveLength(2);
  });

  it('drops consecutive duplicates and invalid coordinates', () => {
    const r = parseGpx(
      wrap(`<trk><trkseg>
        <trkpt lat="1" lon="1"/><trkpt lat="1" lon="1"><ele>5</ele></trkpt>
        <trkpt lat="999" lon="1"/><trkpt lat="abc" lon="1"/>
        <trkpt lat="1.1" lon="1.1"><ele>not-a-number</ele></trkpt>
      </trkseg></trk>`),
    );
    expect(r.points).toEqual([
      { lat: 1, lon: 1, ele: 5 },
      { lat: 1.1, lon: 1.1, ele: null },
    ]);
  });

  it.each([
    ['empty file', '   ', 'GPX_EMPTY_FILE'],
    ['malformed XML', '<gpx><trk>', 'GPX_INVALID_XML'],
    ['non-GPX XML', '<?xml version="1.0"?><kml><Document/></kml>', 'GPX_NOT_GPX'],
    ['waypoints only', wrap('<wpt lat="1" lon="1"/>'), 'GPX_NO_POINTS'],
    ['no points', wrap('<trk><trkseg></trkseg></trk>'), 'GPX_NO_POINTS'],
    ['single point', wrap('<trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk>'), 'GPX_TOO_FEW_POINTS'],
    ['all coords invalid', wrap('<trk><trkseg><trkpt lat="x" lon="1"/><trkpt lat="91" lon="1"/></trkseg></trk>'), 'GPX_BAD_COORDS'],
  ])('rejects %s with a clear error', (_label, text, expected) => {
    expect(code(() => parseGpx(text))).toBe(expected);
  });

  it('error messages are human readable', () => {
    try {
      parseGpx(wrap('<wpt lat="1" lon="1"/>'));
    } catch (e) {
      expect((e as Error).message).toMatch(/waypoints/i);
    }
  });

  it('parses the bundled sample route', () => {
    const text = readFileSync(resolve(process.cwd(), 'public/samples/afsluitdijk-sample.gpx'), 'utf8');
    const r = parseGpx(text);
    expect(r.name).toMatch(/^Sample:/);
    expect(r.points.length).toBeGreaterThan(100);
    expect(r.points.every((p) => p.ele !== null)).toBe(true);
  });
});
