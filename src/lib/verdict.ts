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

/** Below this highest chance (%), forecast rain is called a low chance. */
export const LOW_RAIN_CHANCE = 20;

export interface RainSummary {
  /** Short phrase for the one-line verdict. */
  fact: string;
  /** Headline value for the rain figure. */
  value: string;
  /** Supporting line under the rain figure ('' when there's nothing to add). */
  sub: string;
}

/**
 * Rain wording for a ride, leading with how likely rain is and giving the
 * amount as what to expect if it does rain. A model can forecast a heavy rate
 * at a low chance; stating the rate alone overstates the risk.
 * `rate` formats a rate in mm/h for display, e.g. "4.0 mm/h".
 */
export function rainSummary(maxMmH: number | null, maxChance: number | null, rate: (mmH: number) => string): RainSummary | null {
  if (maxMmH === null) return null;
  const c = maxChance === null ? null : Math.round(maxChance);
  if (maxMmH < 0.05) {
    if (c !== null && c >= 30) return { fact: `${c}% chance of rain`, value: 'Dry', sub: `Highest chance ${c}%` };
    return { fact: 'dry', value: 'Dry', sub: c === null ? '' : `Highest chance ${c}%` };
  }
  const r = rate(maxMmH);
  if (c === null) return { fact: `rain up to ${r}`, value: `Up to ${r}`, sub: '' };
  if (c < LOW_RAIN_CHANCE) return { fact: `low chance of rain (${c}%)`, value: 'Low chance', sub: `${c}%, up to ${r} if it rains` };
  return { fact: `${c}% chance of rain, up to ${r}`, value: `${c}% chance`, sub: `Up to ${r} if it rains` };
}
