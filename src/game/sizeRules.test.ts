import { describe, expect, it } from 'vitest';
import { shrinkScale, sizeDescription } from './sizeRules';

describe('size rules', () => {
  it('maps ten presses to human size and twenty to ant size', () => {
    expect(shrinkScale(10)).toBeCloseTo(1.65 / 7.52, 5);
    expect(shrinkScale(20)).toBeLessThan(shrinkScale(10));
    expect(sizeDescription(10)).toBe('人类大小');
    expect(sizeDescription(20)).toBe('蚂蚁大小');
    expect(sizeDescription(21)).toBe('比蚂蚁更小');
  });
});
