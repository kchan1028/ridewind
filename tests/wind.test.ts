import { describe, expect, it } from 'vitest';
import { classifyWind, compassPoint, relativeWindAngle, windComponents } from '../src/lib/wind';

describe('windComponents (wind direction = where it blows FROM)', () => {
  it('riding north into a north wind is a full headwind', () => {
    expect(windComponents(20, 0, 0)).toEqual({ headwind: 20, crosswind: 0 });
  });
  it('riding north with a south wind is a full tailwind', () => {
    const c = windComponents(20, 180, 0);
    expect(c.headwind).toBeCloseTo(-20, 9);
    expect(c.crosswind).toBeCloseTo(0, 9);
  });
  it('riding north with an east wind is a crosswind from the right', () => {
    const c = windComponents(20, 90, 0);
    expect(c.headwind).toBeCloseTo(0, 9);
    expect(c.crosswind).toBeCloseTo(20, 9);
  });
  it('riding north with a west wind is a crosswind from the left', () => {
    expect(windComponents(20, 270, 0).crosswind).toBeCloseTo(-20, 9);
  });
  it('45° quartering headwind splits evenly', () => {
    const c = windComponents(10, 135, 90); // riding east, wind from SE
    expect(c.headwind).toBeCloseTo(7.071, 3);
    expect(c.crosswind).toBeCloseTo(7.071, 3);
  });
  it('handles wrap-around across north', () => {
    const c = windComponents(10, 350, 10); // wind 20° left of the nose
    expect(c.headwind).toBeCloseTo(10 * Math.cos((20 * Math.PI) / 180), 9);
    expect(c.crosswind).toBeLessThan(0);
  });
});

describe('relativeWindAngle', () => {
  it.each([
    [0, 0, 0],
    [180, 0, 180],
    [350, 10, -20],
    [10, 350, 20],
    [90, 270, 180],
  ])('from %d° heading %d° → %d°', (from, heading, expected) => {
    expect(relativeWindAngle(from, heading)).toBe(expected);
  });
});

describe('classifyWind', () => {
  it.each([
    [20, 0, 0, 'headwind'],
    [20, 45, 0, 'headwind'],
    [20, 46, 0, 'crosswind'],
    [20, 90, 0, 'crosswind'],
    [20, 134, 0, 'crosswind'],
    [20, 135, 0, 'tailwind'],
    [20, 225, 0, 'tailwind'],
    [20, 300, 0, 'crosswind'],
    [4.9, 0, 0, 'calm'],
  ])('%d km/h from %d° heading %d° → %s', (speed, from, heading, expected) => {
    expect(classifyWind(speed, from, heading)).toBe(expected);
  });
});

it('compassPoint', () => {
  expect(compassPoint(0)).toBe('N');
  expect(compassPoint(359)).toBe('N');
  expect(compassPoint(225)).toBe('SW');
  expect(compassPoint(100)).toBe('E');
});
