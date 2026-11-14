import { describe, expect, it } from 'vitest';
import { windVerdict } from '../src/lib/verdict';

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
