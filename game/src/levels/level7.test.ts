import { describe, expect, it } from 'vitest';
import { recoverTime } from './Level7';

describe('level 7', () => {
  it('kappa2 = 2, alpha = 2 recovers from a 1.3 displacement in < 1.5 us', () => {
    expect(recoverTime(2, 2, 1.3)).toBeLessThan(1.5);
  });
  it('a weak stabilizer is slower', () => {
    expect(recoverTime(0.2, 2, 1.3)).toBeGreaterThan(1.5);
  });
});

describe('level 7 slow stabilizer', () => {
  it('kappa2 = 1, alpha = 2 settles after the 1.5 us budget is tight but finite', () => {
    expect(Number.isFinite(recoverTime(1, 2, 1.3, 0.6))).toBe(true);
  });
});
