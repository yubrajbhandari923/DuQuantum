import { describe, expect, it } from 'vitest';
import { alphaSq, overshoot, settlingTime, simulate, type CoupledParams } from '../physics/coupled';
import { LIMITS } from './Level8';

const TP = 2 * Math.PI;
const mk = (g: number, kb: number, eps: number): CoupledParams => ({ g2: g * TP, kappaB: kb * TP, kappaA: 0.0093 * TP, epsD: eps * TP });

describe('level 8 mission', () => {
  it('the starting configuration fails, a tuned one passes', () => {
    const run = (p: CoupledParams) => { const r = simulate(p, 0.3, 4, 0.002, 10); return { s: settlingTime(r.t, r.n, 0.05), o: overshoot(r.n), a2: alphaSq(p) }; };
    const start = run(mk(0.3, 1, 0.9));
    expect(start.a2 < LIMITS.alphaSq[0] || start.s > LIMITS.settle || start.o > LIMITS.overshoot).toBe(true);
    const good = run(mk(0.5, 4, 0.5 * 4.41));
    expect(good.a2).toBeCloseTo(4.41, 6);
    expect(good.s).toBeLessThanOrEqual(LIMITS.settle);
    expect(good.o).toBeLessThanOrEqual(LIMITS.overshoot);
  });
});
