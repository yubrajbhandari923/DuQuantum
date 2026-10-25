import { describe, expect, it } from 'vitest';
import { N, coherentVec, initialRho, observables, step, wignerOf } from './Sandbox';
import { wignerCat, wignerCoherent, alphaUnderLoss } from '../physics/quantum';

const P0 = { k1: 0, k2: 0, dephase: 0, drive: 0 };

describe('sandbox glue', () => {
  it('Fock Wigner reproduces analytic coherent and cat functions', () => {
    const c = initialRho('coherent', 1.3);
    for (const [x, y] of [[1.3, 0], [0.2, 0.7], [-1, 0.4]]) expect(wignerOf(c, x, y)).toBeCloseTo(wignerCoherent(x, y, 1.3), 6);
    const cat = initialRho('cat', 1.5, -1);
    for (const [x, y] of [[0, 0], [0.5, 0.3], [1.5, -0.2]]) expect(wignerOf(cat, x, y)).toBeCloseTo(wignerCat(x, y, 1.5, 'odd'), 6);
  });
  it('knows the sign of Im(alpha) and the |1> negativity', () => {
    const v = coherentVec(0, 1);
    const { ar, ai } = observables({ re: Float64Array.from({ length: N * N }, (_, k) => (v.re[Math.floor(k / N)] * v.re[k % N] + v.im[Math.floor(k / N)] * v.im[k % N])), im: Float64Array.from({ length: N * N }, (_, k) => (v.im[Math.floor(k / N)] * v.re[k % N] - v.re[Math.floor(k / N)] * v.im[k % N])) });
    expect(ar).toBeCloseTo(0, 6); expect(ai).toBeCloseTo(1, 6);
    expect(wignerOf(initialRho('fock', 1), 0, 0)).toBeCloseTo(-2 / Math.PI, 6);
  });
  it('single-photon loss shrinks alpha as exp(-kappa t / 2) and keeps trace', () => {
    let r = initialRho('coherent', 2);
    for (let i = 0; i < 200; i++) r = step(r, { ...P0, k1: 0.5 }, 0.01);
    const o = observables(r);
    expect(o.ar).toBeCloseTo(alphaUnderLoss(2, 0.5, 2), 4);
    expect(o.trace).toBeCloseTo(1, 6);
  });
  it('drive displaces the vacuum by -i eps t', () => {
    let r = initialRho('fock', 0);
    for (let i = 0; i < 100; i++) r = step(r, { ...P0, drive: 0.5 }, 0.01);
    expect(observables(r).ai).toBeCloseTo(-0.5, 4);
  });
});
