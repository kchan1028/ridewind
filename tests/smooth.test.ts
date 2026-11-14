import { describe, expect, it } from 'vitest';
import { smoothByDistance } from '../src/lib/smooth';

const at = (n: number, step = 100) => Array.from({ length: n }, (_, i) => i * step);

describe('smoothByDistance', () => {
  it('leaves a constant series unchanged', () => {
    expect(smoothByDistance([5, 5, 5, 5], at(4), 800)).toEqual([5, 5, 5, 5]);
  });
  it('flattens a one-step spike', () => {
    const out = smoothByDistance([0, 0, 0, 0, 90, 0, 0, 0, 0], at(9), 800);
    expect(out[4]).toBeCloseTo(10, 6); // 90 spread over 9 points within ±400 m
    expect(Math.max(...(out as number[]))).toBeLessThan(20);
  });
  it('averages only within half the window either side', () => {
    expect(smoothByDistance([1, 2, 3], at(3, 1000), 800)).toEqual([1, 2, 3]);
  });
  it('keeps gaps as gaps and leaves them out of the average', () => {
    expect(smoothByDistance([4, null, 8], at(3), 800)).toEqual([6, null, 6]);
  });
});
