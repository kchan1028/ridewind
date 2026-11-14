import { describe, expect, it } from 'vitest';
import { rainSummary, windVerdict } from '../src/lib/verdict';

const d = (o: Partial<Record<'headwind' | 'tailwind' | 'crosswind' | 'calm' | 'unknown', number>>) => ({
  headwind: 0,
  tailwind: 0,
  crosswind: 0,
  calm: 0,
  unknown: 0,
  ...o,
});

describe('windVerdict', () => {
  it.each([
    [d({ tailwind: 92, crosswind: 8 }), 'Mostly tailwind', 'tailwind'],
    [d({ headwind: 50, crosswind: 30, tailwind: 20 }), 'Mostly headwind', 'headwind'],
    [d({ calm: 70, headwind: 30 }), 'Mostly calm', 'calm'],
    [d({ headwind: 40, tailwind: 40, crosswind: 20 }), 'Headwind one way, tailwind the other', 'mixed'],
    [d({ headwind: 30, crosswind: 40, tailwind: 20, calm: 10 }), 'Mixed winds', 'mixed'],
  ])('%o → %s', (input, headline, tone) => {
    expect(windVerdict(input)).toEqual({ headline, tone });
  });
  it('ignores unknown distance when it is the minority', () => {
    expect(windVerdict(d({ tailwind: 60, crosswind: 10, unknown: 30 })).headline).toBe('Mostly tailwind');
  });
  it('does not guess when most of the ride has no forecast', () => {
    expect(windVerdict(d({ tailwind: 20, unknown: 80 }))).toEqual({ headline: 'Mostly outside the forecast', tone: 'unknown' });
    expect(windVerdict(d({})).tone).toBe('unknown');
  });
});

describe('rainSummary', () => {
  const rate = (mm: number) => `${mm.toFixed(1)} mm/h`;

  it('leads with a low chance instead of an alarming rate', () => {
    expect(rainSummary(4, 11, rate)).toEqual({ fact: 'low chance of rain (11%)', value: 'Low chance', sub: '11%, up to 4.0 mm/h if it rains' });
  });

  it('gives the chance first, then the rate, when rain is likely', () => {
    expect(rainSummary(2.5, 60, rate)).toEqual({ fact: '60% chance of rain, up to 2.5 mm/h', value: '60% chance', sub: 'Up to 2.5 mm/h if it rains' });
  });

  it('falls back to the rate when no chance is forecast', () => {
    expect(rainSummary(1, null, rate)).toEqual({ fact: 'rain up to 1.0 mm/h', value: 'Up to 1.0 mm/h', sub: '' });
  });

  it('calls a dry forecast dry, noting a high chance', () => {
    expect(rainSummary(0, 5, rate)).toEqual({ fact: 'dry', value: 'Dry', sub: 'Highest chance 5%' });
    expect(rainSummary(0, 40, rate)?.fact).toBe('40% chance of rain');
  });

  it('returns null without any rain data', () => {
    expect(rainSummary(null, null, rate)).toBeNull();
  });
});
