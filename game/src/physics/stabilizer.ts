// Ideal two-photon stabilizer in the Fock basis (truncated). Cat vectors c_n for |alpha> +- |-alpha>.
import { catPn, type CatParity } from './quantum';

/** || (a^2 - alpha^2) |psi> || for a cat built in a Fock space truncated at N. ~0 means a dark state. */
export function darkResidual(alpha: number, parity: CatParity, N = 40): number {
  const c = Array.from({ length: N }, (_, n) => Math.sqrt(catPn(n, alpha, parity)));
  let r = 0;
  for (let n = 0; n < N - 2; n++) {
    const v = Math.sqrt((n + 1) * (n + 2)) * c[n + 2] - alpha * alpha * c[n];
    r += v * v;
  }
  return Math.sqrt(r);
}

/** Time to relax to within `tol` (fraction) of alpha for dx/dt = kappa2 x (alpha^2 - x^2), by RK4 stepping. */
export function recoveryTime(kappa2: number, alpha: number, x0: number, tol = 0.02, dt = 0.001, tMax = 50): number {
  let x = x0, t = 0;
  const f = (y: number) => kappa2 * y * (alpha * alpha - y * y);
  while (t < tMax) {
    if (Math.abs(x - alpha) <= tol * alpha) return t;
    const k1 = f(x), k2 = f(x + 0.5 * dt * k1), k3 = f(x + 0.5 * dt * k2), k4 = f(x + dt * k3);
    x += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4); t += dt;
  }
  return Infinity;
}
