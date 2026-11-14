/**
 * Centred moving average by distance. Each value becomes the mean of the known
 * values within `windowM / 2` of its position. Missing values (null) stay
 * missing and are left out of their neighbours' averages, so a gap in the
 * forecast is never filled in.
 */
export function smoothByDistance(values: Array<number | null>, positionsM: number[], windowM: number): Array<number | null> {
  const half = windowM / 2;
  return values.map((v, i) => {
    if (v === null) return null;
    const at = positionsM[i]!;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && at - positionsM[j]! <= half; j--) {
      const w = values[j];
      if (w !== null && w !== undefined) {
        sum += w;
        n++;
      }
    }
    for (let j = i + 1; j < values.length && positionsM[j]! - at <= half; j++) {
      const w = values[j];
      if (w !== null && w !== undefined) {
        sum += w;
        n++;
      }
    }
    return sum / n;
  });
}
