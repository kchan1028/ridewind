import type { SegmentClass } from './ride';

export type VerdictTone = 'headwind' | 'tailwind' | 'crosswind' | 'calm' | 'mixed' | 'unknown';

/**
 * One-line summary of the wind over a ride, from the distance in each class.
 * "Mostly X" needs at least half of the forecast-covered distance; otherwise
 * the ride is called mixed. If less than half the route has a forecast the
 * verdict says so instead of guessing.
 */
export function windVerdict(distanceByClass: Record<SegmentClass, number>): { headline: string; tone: VerdictTone } {
  const { headwind, tailwind, crosswind, calm, unknown } = distanceByClass;
  const known = headwind + tailwind + crosswind + calm;
  if (known <= 0 || unknown > known) return { headline: 'Mostly outside the forecast', tone: 'unknown' };
  const share = (m: number) => m / known;
  const ranked = (
    [
      ['headwind', headwind],
      ['tailwind', tailwind],
      ['crosswind', crosswind],
      ['calm', calm],
    ] as const
  )
    .slice()
    .sort((a, b) => b[1] - a[1]);
  const [topClass, topM] = ranked[0]!;
  if (share(topM) >= 0.5) {
    const names = { headwind: 'Mostly headwind', tailwind: 'Mostly tailwind', crosswind: 'Mostly crosswind', calm: 'Mostly calm' };
    return { headline: names[topClass], tone: topClass };
  }
  if (share(headwind) >= 0.25 && share(tailwind) >= 0.25) return { headline: 'Headwind one way, tailwind the other', tone: 'mixed' };
  return { headline: 'Mixed winds', tone: 'mixed' };
}
