"""Task 2.4(a): which terms of the ATS Hamiltonian survive the rotating-wave step, and the size of the rest.

H_ATS = 2 E_J sin(eps_p cos w_p t) sin(phi) ~ 2 E_J eps_p cos(w_p t) sin(phi) at phi_Delta = pi/2, phi_Sigma = -pi/2 + eps_p cos w_p t.
Normal ordering, sin(phi) = e_r :sin(phi):, e_r = exp(-(phi_a^2 + phi_b^2)/2), and
:sin(phi): = sum over odd n = p + q + r + s of (-1)^((n-1)/2) phi_a^(p+q) phi_b^(r+s) a+^p a^q b+^r b^s / (p! q! r! s!).
In the frame rotating at w_a, w_b each monomial with cos(w_p t) carries frequencies (p-q) w_a + (r-s) w_b +/- w_p.
Second order: H_eff = sum over nu > 0 of [M_nu, M_nu^dag] / nu, M_nu the coefficient of e^{i nu t}, evaluated as matrices.
Frequencies are f = omega / 2 pi in GHz throughout. python scripts/task2_4_circuit.py | tee logs/task2_4_circuit.log
"""
from collections import defaultdict
from itertools import product
from math import factorial

import numpy as np
from scipy.special import jv

FA, FB = 4.0, 4.8                     # GHz
FP = 2 * FA - FB
EJ, PA, PB = 40.0, 0.06, 0.3
G2, KB, KA = 0.763e-3, 2.6e-3, 9.3e-6   # GHz
K2 = 4 * G2**2 / KB
NMAX, ORDER = 16, 5                   # Fock cutoff per mode for the matrices, highest order of :sin(phi): kept
LOW = [(na, nb) for na in range(5) for nb in range(3)]   # states whose second-order energies are read (far from NMAX)


def monomials(order=ORDER):
    """(p, q, r, s, coefficient of a+^p a^q b+^r b^s in :sin(phi):)."""
    for p, q, r, s in product(range(order + 1), repeat=4):
        n = p + q + r + s
        if n % 2 and n <= order:
            yield p, q, r, s, (-1)**((n - 1) // 2) * PA**(p + q) * PB**(r + s) / (
                factorial(p) * factorial(q) * factorial(r) * factorial(s))


def main():
    er = np.exp(-(PA**2 + PB**2) / 2)
    eps_p = 2 * G2 / (EJ * PA**2 * PB)
    A = EJ * eps_p                    # 2 E_J eps_p cos(w_p t) = E_J eps_p (e^{i w_p t} + e^{-i w_p t})
    print(f'w_p/2pi = 2 w_a - w_b = {FP:.1f} GHz; eps_p = 2 g2/(E_J phi_a^2 phi_b) = {eps_p:.5f} rad; E_J eps_p = '
          f'{A * 1e3:.1f} MHz; normal-ordering factor e_r = exp(-(phi_a^2 + phi_b^2)/2) = {er:.5f}, so with it '
          f'g2 = {G2 * er * 1e3:.4f} MHz at this eps_p and eps_p = {eps_p / er:.5f} gives 0.763 MHz', flush=True)
    print(f'sin(eps_p cos w_p t) = eps_p cos w_p t (1 - O(eps_p^2/6)), eps_p^2/6 = {eps_p**2 / 6:.1e}', flush=True)
    # cubic check: 2 E_J eps_p cos(w_p t) (-phi^3/6) contains -E_J eps_p (3 phi_a^2 phi_b / 6) (a^2 b+ e^{i(w_p - 2w_a + w_b)t} + h.c.)
    print(f'cubic term: coefficient of a^2 b+ = -E_J eps_p phi_a^2 phi_b/2 = {-A * PA**2 * PB / 2 * 1e3:.4f} MHz', flush=True)

    # every monomial at both pump sidebands
    terms = []
    for p, q, r, s, c in monomials():
        for sgn in (1, -1):
            terms.append(((p - q) * FA + (r - s) * FB + sgn * FP, p, q, r, s, A * er * c))
    res = [t for t in terms if abs(t[0]) < 1e-9]
    print(f'\nresonant monomials up to order {ORDER} (k_a w_a + k_b w_b = -/+ w_p):', flush=True)
    for nu, p, q, r, s, c in res:
        print(f'  a+^{p} a^{q} b+^{r} b^{s}: {c * 1e3:+.5f} MHz', flush=True)
    sol = [(ka, kb) for ka in range(-15, 16) for kb in range(-15, 16)
           if abs(ka * FA + kb * FB - FP) < 1e-9 and (abs(ka) + abs(kb)) % 2]
    print('odd-order solutions of k_a w_a + k_b w_b = w_p with |k| <= 15 (lowest order |k_a| + |k_b|): '
          + ', '.join(f'({ka}, {kb})' for ka, kb in sorted(sol, key=lambda k: abs(k[0]) + abs(k[1]))), flush=True)
    sol3 = [(ka, kb) for ka in range(-15, 16) for kb in range(-15, 16)
            if abs(ka * FA + kb * FB - 3 * FP) < 1e-9 and (abs(ka) + abs(kb)) % 2]
    print('odd-order solutions at 3 w_p (pump third harmonic, ~eps_p^3): '
          + ', '.join(f'({ka}, {kb})' for ka, kb in sorted(sol3, key=lambda k: abs(k[0]) + abs(k[1]))[:3]), flush=True)
    g2_dress_a = -PA**2 / 3
    g2_dress_b = -PB**2 / 2
    print(f'fifth-order dressing: g2 -> g2 (1 {g2_dress_a:+.5f} a+a {g2_dress_b:+.4f} b+b); at n_a = alpha^2 = 4.41: '
          f'{g2_dress_a * 4.41:+.2e}, at n_b = 6.70 (buffer when the memory crosses a = 0, Task 2.1): {g2_dress_b * 6.70:+.2e}',
          flush=True)

    print('\nlargest non-resonant terms, order <= 3, by |coefficient / detuning| (MHz, GHz):', flush=True)
    nr = sorted([t for t in terms if abs(t[0]) > 1e-9 and t[1] + t[2] + t[3] + t[4] <= 3 and t[0] > 0],
                key=lambda t: -abs(t[5] / t[0]))
    for nu, p, q, r, s, c in nr[:10]:
        print(f'  a+^{p} a^{q} b+^{r} b^{s} at {nu:+.1f} GHz: {abs(c) * 1e3:9.3f} MHz, ratio {abs(c / nu):.2e}', flush=True)
    print('smallest detunings among non-resonant terms (order <= 5): '
          + ', '.join(sorted({f'{abs(t[0]):.1f}' for t in terms if abs(t[0]) > 1e-9}, key=float)[:5]) + ' GHz', flush=True)

    # second order in the oscillating terms, as matrices
    a1 = np.diag(np.sqrt(np.arange(1, NMAX)), 1)
    a, b = np.kron(a1, np.eye(NMAX)), np.kron(np.eye(NMAX), a1)
    mp = lambda m, k: np.linalg.matrix_power(m, k)
    groups = defaultdict(lambda: 0)
    for nu, p, q, r, s, c in terms:
        if nu > 1e-9:
            groups[round(nu, 9)] = groups[round(nu, 9)] + c * mp(a.T, p) @ mp(a, q) @ mp(b.T, r) @ mp(b, s)
    Heff = sum((M @ M.conj().T - M.conj().T @ M) / nu for nu, M in groups.items())
    # check the sign convention on a driven oscillator: Omega (a e^{-i nu t} + h.c.) shifts vacuum by -Omega^2/nu
    M = 0.1 * a.T
    assert abs(((M @ M.T - M.T @ M) / 2.0)[0, 0] + 0.1**2 / 2.0) < 1e-12
    E = {(na, nb): Heff[na * NMAX + nb, na * NMAX + nb].real for na, nb in LOW}
    offdiag = np.abs(Heff - np.diag(np.diag(Heff)))[np.ix_(*[[na * NMAX + nb for na, nb in LOW]] * 2)].max()
    da, db = E[1, 0] - E[0, 0], E[0, 1] - E[0, 0]
    Ka = E[2, 0] - 2 * E[1, 0] + E[0, 0]
    Kb = E[0, 2] - 2 * E[0, 1] + E[0, 0]
    chi = E[1, 1] - E[1, 0] - E[0, 1] + E[0, 0]
    Ka3 = E[3, 0] - 3 * E[2, 0] + 3 * E[1, 0] - E[0, 0]
    print(f'\nsecond order (order <= {ORDER}, {len(groups)} frequencies, Fock cutoff {NMAX}): H_eff = d_a n_a + d_b n_b + '
          f'K_a/2 n_a(n_a-1) + K_b/2 n_b(n_b-1) + chi n_a n_b, largest off-diagonal element among n_a <= 4, n_b <= 2: '
          f'{offdiag * 1e3:.1e} MHz', flush=True)
    print(f'  Stark shifts d_a = {da * 1e3:+.4f} MHz, d_b = {db * 1e3:+.3f} MHz; Kerr K_a = {Ka * 1e6:+.3f} kHz, '
          f'K_b = {Kb * 1e3:+.4f} MHz, cross-Kerr chi = {chi * 1e6:+.2f} kHz; third difference in n_a {Ka3 * 1e6:+.3f} kHz', flush=True)
    print(f'  against g2 = {G2 * 1e3:.3f} MHz, kappa_2 = {K2 * 1e3:.4f} MHz, kappa_b = {KB * 1e3:.1f} MHz, kappa_a = {KA * 1e6:.1f} kHz: '
          f'|K_a| n_a/kappa_2 at n_a = 4.41 is {abs(Ka) * 4.41 / K2:.1e}, |K_a|/kappa_a = {abs(Ka) / KA:.3f}, '
          f'chi n_b at the readout n_b = 4.3e-3 (eps_Z = 0.2 g2, Task 2.3) is {abs(chi) * 4.3e-3 * 1e6:.2f} kHz', flush=True)

    # same Stark shifts non-perturbatively: the linear pump terms displace both modes, phi -> phi - delta cos(w_p t)
    delta = 2 * A * er * sum(p**2 * 2 * f / (f**2 - FP**2) for p, f in ((PA, FA), (PB, FB)))
    xa, xb = (A * er * p * (1 / (f - FP) + 1 / (f + FP)) for p, f in ((PA, FA), (PB, FB)))
    c = 2 * A * er * jv(1, delta)      # static -c cos(phi) after the time average of cos(w_p t) sin(phi - delta cos w_p t)
    print(f'\npump-driven displacements: memory {xa:.4f}, buffer {xb:.4f}; flux swing delta = {delta:.4f} rad; static '
          f'term -2 E_J eps_p J1(delta) e_r :cos(phi):, which gives d_a = {c * PA**2 * 1e3:+.4f} MHz, '
          f'd_b = {c * PB**2 * 1e3:+.3f} MHz, K_a = {-c * PA**4 / 2 * 1e6:+.3f} kHz, chi = {-c * PA**2 * PB**2 * 1e6:+.2f} kHz '
          f'(K_a, chi from :phi^4:/24 only)', flush=True)

    # readout drive
    eZ = 0.1 * G2
    eps_r = eZ / (EJ * PA * er)
    print(f'\nreadout drive eps_Z = 0.1 g2 = {eZ * 1e6:.1f} kHz. Memory port tone 2 eps_Z cos(w_a t)(a + a+): counter-rotating part '
          f'at 2 w_a = {2 * FA:.0f} GHz; for a linear drive [a+, a] is a c-number, so it only adds a constant energy offset and '
          f'a displacement eps_Z/(2 w_a) = {eZ / (2 * FA):.1e}, no frequency shift', flush=True)
    print(f'ATS flux tone eps_r cos(w_a t) added to phi_Sigma: 2 E_J eps_r cos(w_a t) e_r phi_a (a + a+) -> E_J eps_r e_r phi_a (a + a+), '
          f'so eps_r = eps_Z/(E_J e_r phi_a) = {eps_r:.3e} rad; its buffer part E_J eps_r e_r phi_b = {EJ * eps_r * er * PB * 1e6:.1f} kHz '
          f'is {FB - FA:.1f} GHz off resonance (displacement {EJ * eps_r * er * PB / (FB - FA):.1e}); dressing of eps_Z: '
          f'1 - phi_a^2 a+a/2 - phi_b^2 b+b = 1 {-PA**2 / 2 * 4.41:+.2e} at n_a = 4.41', flush=True)


if __name__ == '__main__':
    main()
