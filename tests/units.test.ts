import { describe, expect, it } from 'vitest';
import { defaultUnits } from '../src/lib/units';

describe('defaultUnits', () => {
  it.each([
    ['en-US', 'imperial'],
    ['es_US', 'imperial'],
    ['en-GB', 'metric'],
    ['de-DE', 'metric'],
    ['en', 'metric'],
    ['', 'metric'],
  ] as const)('%s → %s', (lang, expected) => {
    expect(defaultUnits(lang)).toBe(expected);
  });
});
