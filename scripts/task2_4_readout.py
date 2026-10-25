"""Task 2.4(b-d): readout contrast and bit-flip rate against the readout drive eps_Z, and two ways to do better.

python scripts/task2_4_readout.py I   runs TASKS[I] (one Slurm array task, slurm/task2_4.sh), cached in results/task2_4/
python scripts/task2_4_readout.py     analysis and plots from the cache (under a minute)
Gamma_X(eps_Z) at alpha <= 1.4 is the slowest nonzero Liouvillian eigenvalue in the full space (the drive mixes the parity
sectors; the zero eigenvalue is the steady state). Shift-invert at sigma = 0, as in Task 2.1 slow_eigs, factorizes a singular
matrix there and returned eigenvalues with positive real parts; a positive shift SIGMA keeps the order 0, -Gamma_X, ... At alpha = 2.1 and 2.5 it is the relative
late-time slope of Re<a> from |+alpha>|0> as in Task 2.3, which the 20 us run at alpha = 1.4 checks against the eigenvalue.
"""
import sys
import time

import dynamiqs as dq
import numpy as np
import scipy.sparse as sp
from scipy.optimize import minimize
from scipy.sparse.linalg import eigs
from scipy.special import erfc, erfcinv

from common import COLORS, METHOD, RESULTS, g2, kappa_a, save, style
from task2_1_bit_flip import TRUNC, check_trunc, fit_decay, liouvillian, odd_sector
from task2_3_readout import G2, KB, T, drift_line, first_order, mean_field, model, rel_slope, settling_time, solve_b
import matplotlib.pyplot as plt

CACHE = RESULTS / 'task2_4'
ALPHAS = [0.8, 1.0, 1.2, 1.4]
EPS = [0.0, 0.025, 0.05, 0.1, 0.2, 0.4]          # eps_Z / g2, eigenvalue sweep
EPS_KA0, EPS_CHECK = [0.05, 0.1, 0.2], [0.1, 0.4]
EPS_STRONG = [0.05, 0.1, 0.2, 0.4, 0.8, 1.2, 1.6, 2.4, 3.2]   # alpha = 2.1 time runs at 24 x 8
GAMMA_X0 = {2.1: 3.8490e-07}                      # Task 2.1 final value at eps_Z = 0 (logs/task2_1_analysis.log)
KERR = 2 * np.pi * np.array([-4.941e-3, -2.6727, -0.19948])   # K_a, K_b, chi (rad/us) from logs/task2_4_circuit.log
POLE = -4.727 + 20.078j                           # Task 2.3 dominant pole of the first-order response (1/us)
P_ERR = 0.01
SIGMA = 0.2                                       # 1/us, shift-invert target, right of the whole spectrum
T_LONG = np.linspace(0.0, 20.0, 2001)
T3 = T[T <= 3.0]                                  # 0-3 us for the 36 x 14 check at alpha = 2.5 (under 10 min)


def kerr_part(Na, Nb):
    """-i[H_K, .] for H_K = K_a/2 a+^2 a^2 + K_b/2 b+^2 b^2 + chi a+a b+b, in the column-stacked convention of liouvillian."""
    a, b = dq.destroy(Na, Nb)
    Ka, Kb, chi = KERR
    H = Ka / 2 * a.dag() @ a.dag() @ a @ a + Kb / 2 * b.dag() @ b.dag() @ b @ b + chi * a.dag() @ a @ b.dag() @ b
    H = sp.csr_matrix(np.asarray(H.to_numpy()))
    I = sp.identity(H.shape[0], format='csr')
    return -1j * sp.kron(I, H) + 1j * sp.kron(H.T, I)


def eig_point(alpha, Na, Nb, e, ka=kappa_a, kerr=False):
    f = CACHE / f'eigs_{alpha:.2f}_{Na}_{Nb}_{e:g}_{ka / kappa_a:g}{"_kerr" if kerr else ""}.npz'
    if not f.exists():
        t0 = time.time()
        L = liouvillian(alpha, Na, Nb, eps_Z=e * G2, ka=ka)
        lam, v = eigs((L + kerr_part(Na, Nb)).tocsc() if kerr else L, k=4, sigma=SIGMA, which='LM')
        o = np.argsort(np.abs(lam))
        lam, v = lam[o], v[:, o]
        odd = odd_sector(Na, Nb)
        w = np.linalg.norm(v[odd], axis=0) / np.linalg.norm(v, axis=0)
        np.savez(f, lam=lam, w=w, seconds=time.time() - t0)
        print(f'alpha={alpha} {Na}x{Nb} eps_Z/g2={e:g} ka/kappa_a={ka / kappa_a:g}: lam = {np.round(lam, 8)}, odd weight '
              f'{np.round(w, 3)}, {time.time() - t0:.0f} s', flush=True)
    d = np.load(f)
    return -d['lam'][1].real, d['lam'][1].imag, d['w'][1], float(d['seconds'])   # [0] is the steady state


def b_point(alpha, Na, Nb, e, t=T):
    f = CACHE / f'b_{alpha:.2f}_{Na}_{Nb}_{e:g}_{t[-1]:g}.npz'
    if not f.exists():
        t0 = time.time()
        np.savez(f, seconds=0.0, **solve_b(Na, Nb, e * G2, t, alpha))
        d = dict(np.load(f))
        d['seconds'] = time.time() - t0
        np.savez(f, **d)
        print(f'alpha={alpha} {Na}x{Nb} eps_Z/g2={e:g}: Re<b>(end) = {d["b"][0, -1].real:+.6f}, {d["seconds"]:.0f} s', flush=True)
    return dict(np.load(f))


def posicast(pole=POLE):
    """Two-step turn-on from a pole s = -g + i w: eps/(1 + M) at t = 0, eps from t1 = pi/w, M = exp(-g pi/w). For a pure
    damped oscillator the first half-period lands exactly on the final value with zero slope and the ringing cancels."""
    g, w = -pole.real, pole.imag
    return 1 / (1 + np.exp(-g * np.pi / w)), np.pi / w


def fitted_shape(Md=24, Mb=10):
    """(c, t1) minimizing the largest deviation of the first-order response to c H(t) + (1 - c) H(t - t1) from its
    final value after t1 + 0.05 us (the same response at 24 x 10 levels as Task 2.3)."""
    t = np.linspace(0.0, 4.0, 4001)
    r = -2 * 2.1 * G2 * first_order(t, Md, Mb)[1].real        # unit step response of the half contrast
    resp = lambda c, t1: c * r + (1 - c) * np.interp(t - t1, t, r, left=0.0)
    cost = lambda x: np.abs(resp(*x)[t > x[1] + 0.05] - 1).max()
    x = minimize(cost, posicast(), method='Nelder-Mead', options=dict(xatol=1e-6, fatol=1e-8)).x
    return x, cost(x), cost(posicast())


def shaped_point(Na, Nb, e, c, t1, tag):
    f = CACHE / f'shaped_{tag}_{Na}_{Nb}_{e:g}.npz'
    if not f.exists():
        t0 = time.time()
        H, jumps, a, b = model(Na, Nb, 0.0)
        H = H + dq.pwc([0.0, t1, T[-1] + 1.0], [c * e * G2, e * G2], a + a.dag())
        psi0 = dq.stack([dq.tensor(dq.coherent(Na, s * 2.1), dq.fock(Nb, 0)) for s in (1, -1)])
        r = dq.mesolve(H, jumps, psi0, T, exp_ops=[b, a], method=METHOD, save_states=False, progress_meter=False)
        ex = np.asarray(r.expects)
        np.savez(f, b=ex[:, 0], a=ex[:, 1], c=c, t1=t1, seconds=time.time() - t0)
        print(f'shaped {tag} {Na}x{Nb} eps_Z/g2={e:g}: c = {c:.4f}, t1 = {t1:.4f} us, {time.time() - t0:.0f} s', flush=True)
    return dict(np.load(f))


def task(i):
    """Array tasks: 0-3 eigenvalues per alpha, 4 the 20 us check at alpha = 1.4, 5-13 alpha = 2.1 strong drives,
    14 the 32 x 12 check at 1.6 g2, 15-17 and 19-21 alpha = 2.5, 18 the shaped turn-on."""
    if i < 4:
        alpha = ALPHAS[i]
        for e in EPS:
            eig_point(alpha, *TRUNC[alpha], e)
        for e in EPS_KA0:
            eig_point(alpha, *TRUNC[alpha], e, ka=0.0)
        for e in EPS_CHECK:
            eig_point(alpha, *check_trunc(alpha), e)
    elif i == 4:
        for e in (0.1, 0.2):
            b_point(1.4, *TRUNC[1.4], e, T_LONG)
    elif i < 14:
        b_point(2.1, 24, 8, EPS_STRONG[i - 5])
    elif i == 14:
        b_point(2.1, 32, 12, 1.6)
    elif i < 18:
        b_point(2.5, *[(24, 8, 0.2), (32, 12, 0.2), (24, 8, 0.8)][i - 15])
    elif i == 19:
        b_point(2.5, 32, 12, 0.8)
    elif i == 20:
        b_point(2.5, 36, 14, 0.2, T3)
    elif i == 21:
        b_point(2.5, 36, 14, 0.8, T3)
    elif i == 18:
        x, _, _ = fitted_shape()
        for e in (0.1, 1.6):
            shaped_point(24, 8, e, *posicast(), 'pole')
            shaped_point(24, 8, e, *x, 'fit')


def flip_td(t, x, t0=3.0, t1=4.0):
    """Switching rate: log-linear fit of Re<a>(t) on [t0, t1]. The Task 2.3 drift-line slope c1/c0 takes its intercept at
    t = 0 and so returns Gamma/(1 + Gamma t_mid), which matters once Gamma t_mid is not small."""
    return fit_decay(t, x, t0, t1)[0] if t[-1] >= t1 else np.nan


def half(d):
    """Half contrast (Re<b>_- - Re<b>_+)/2, its quasi-steady value and drift line (Task 2.3), relative slope of Re<a>."""
    r = (d['b'][1].real - d['b'][0].real) / 2
    c0, c1 = drift_line(T if r.size == T.size else T_LONG, r)
    return r, c0, c1


def p_total(tau, r, gam):
    """Misassignment of ideal homodyne over tau plus the probability that the codeword flipped, (1 - e^{-Gamma_X tau})/2."""
    return 0.5 * erfc(np.sqrt(2 * KB * tau) * r) + 0.5 * (1 - np.exp(-gam * tau))


def tau_1(r):
    return erfcinv(2 * P_ERR)**2 / (2 * KB * r**2)


def analyze():
    lin = lambda e, alpha: e / (2 * alpha)          # |Re<b>_ss| = eps_Z/(2 alpha g2), eps_Z = e g2

    # (b) Gamma_X against eps_Z at alpha <= 1.4
    print('Gamma_X(eps_Z) from the slowest nonzero full-space eigenvalue (chosen truncation, Task 2.1):', flush=True)
    G = {}
    for alpha in ALPHAS:
        Na, Nb = TRUNC[alpha]
        rows = [eig_point(alpha, Na, Nb, e) for e in EPS]
        G[alpha] = np.array([r[0] for r in rows])
        g0 = G[alpha][0]
        print(f'  alpha={alpha} ({Na}x{Nb}): ' + ', '.join(
            f'{e:g}: {g:.4e} (Im {im:+.0e}, odd weight {w:.3f}, {s:.0f} s)' for e, (g, im, w, s) in zip(EPS, rows)), flush=True)
        dG = G[alpha][1:] - g0
        k = np.polyfit(np.log(EPS[1:4]), np.log(dG[:3]), 1)[0]
        print(f'  alpha={alpha}: Gamma_X/Gamma_X(0) = ' + ', '.join(f'{x:.3f}' for x in G[alpha] / g0)
              + f'; (Gamma_X - Gamma_X(0))/eps_Z^2 (us) = ' + ', '.join(f'{x / (e * G2)**2:.4e}' for x, e in zip(dG, EPS[1:]))
              + f'; log slope of Gamma_X - Gamma_X(0) over eps_Z/g2 = 0.025-0.1 (n = 3): {k:.3f}', flush=True)
        ka0 = [eig_point(alpha, Na, Nb, e, ka=0.0) for e in EPS_KA0]
        print(f'  alpha={alpha} kappa_a = 0: ' + ', '.join(f'{e:g}: {g:.4e} (odd weight {w:.3f}), ratio to Gamma_X - Gamma_X(0) '
              f'{g / (G[alpha][EPS.index(e)] - g0):.4f}' for e, (g, _, w, _) in zip(EPS_KA0, ka0)), flush=True)
        ch = [eig_point(alpha, *check_trunc(alpha), e) for e in EPS_CHECK]
        print(f'  alpha={alpha} check {check_trunc(alpha)}: ' + ', '.join(
            f'{e:g}: {g:.6e} ({g / G[alpha][EPS.index(e)] - 1:+.1e}, {s:.0f} s)' for e, (g, _, _, s) in zip(EPS_CHECK, ch)), flush=True)
    c2 = {a: (G[a][EPS.index(0.1)] - G[a][0]) / (0.1 * G2)**2 for a in ALPHAS}
    # the second-order Kerr terms of part (a) added to the model, alpha = 1.4
    kz = {e: eig_point(1.4, *TRUNC[1.4], e, kerr=True) for e in (0.0, 0.1)}
    k20 = eig_point(1.4, *check_trunc(1.4), 0.1, kerr=True)
    print(f'  alpha=1.4 with K_a, K_b, chi of part (a): ' + ', '.join(
        f'{e:g}: {g:.4e} (ratio to without {g / G[1.4][EPS.index(e)]:.4f}, Im {im:+.0e}, odd weight {w:.3f}, {s:.0f} s)'
        for e, (g, im, w, s) in kz.items()) + f'; check {check_trunc(1.4)} at 0.1: {k20[0]:.4e} ({k20[0] / kz[0.1][0] - 1:+.1e}, '
        f'{k20[3]:.0f} s)', flush=True)

    # time-domain check at alpha = 1.4: log-linear decay rate of Re<a> against the eigenvalue, and the contrast
    print('\nalpha = 1.4, 20 us runs (16x5) against the eigenvalue:', flush=True)
    for e in (0.1, 0.2):
        d = b_point(1.4, *TRUNC[1.4], e, T_LONG)
        x = d['a'][0].real
        ge = G[1.4][EPS.index(e)]
        f34, f1520 = flip_td(T_LONG, x, 3.0, 4.0), flip_td(T_LONG, x, 15.0, 20.0)
        s34 = -rel_slope(T_LONG[T_LONG <= 4], x[T_LONG <= 4])
        r, c0, _ = half(d)
        print(f'  eps_Z/g2={e:g}: log-linear fit of Re<a> on 3-4 us (n = {((T_LONG >= 3) & (T_LONG <= 4)).sum()}) {f34:.4e}, '
              f'on 15-20 us (n = {(T_LONG >= 15).sum()}) {f1520:.4e} /us vs eigenvalue {ge:.4e} (ratios {f34 / ge:.5f}, '
              f'{f1520 / ge:.5f}); Task 2.3 drift-line slope over 3-4 us {s34:.4e} (ratio {s34 / ge:.4f}, = 1/(1 + 3.5 Gamma_X) '
              f'= {1 / (1 + 3.5 * ge):.4f}, the intercept sits at t = 0); quasi-steady half contrast {c0:.6f} vs '
              f'eps_Z/(2 alpha g2) = {lin(e, 1.4):.6f} (ratio {c0 / lin(e, 1.4):.4f}), {float(d["seconds"]):.0f} s', flush=True)

    # alpha = 2.1: contrast and switching against eps_Z
    print('\nalpha = 2.1 at 24x8, 0-4 us from |+/-alpha>|0>, switching rate = log-linear fit of Re<a> on 3-4 us:', flush=True)
    S = {}
    for e in EPS_STRONG:
        d = b_point(2.1, 24, 8, e)
        r, c0, c1 = half(d)
        lam = flip_td(T, d['a'][0].real)
        mf = mean_field(e * G2, 2.1)[1][-1].real
        ts = settling_time(T, r, ref=c0 + c1 * T)
        S[e] = dict(r=r, c0=c0, lam=lam, ts=ts, mf=-mf)
        print(f'  eps_Z/g2={e:g}: half contrast {c0:.6f} (linear {lin(e, 2.1):.6f}, ratio {c0 / lin(e, 2.1):.4f}; mean field '
              f'{-mf:.6f}, ratio {-mf / lin(e, 2.1):.4f}), switching rate {lam:.4e} /us, lambda/eps_Z^2 = {lam / (e * G2)**2:.4e} us, '
              f'settles to 1% at {ts:.3f} us, n_b(4 us) {d["n_b"][0, -1]:.4f}, max top-2 memory {d["top_a"].max():.1e}, '
              f'top buffer {d["top_b"].max():.1e}, {float(d["seconds"]):.0f} s', flush=True)
    d = b_point(2.1, 32, 12, 1.6)
    r, c0, _ = half(d)
    lam = flip_td(T, d['a'][0].real)
    print(f'  check 32x12 at 1.6 g2: half contrast {c0:.6f} ({c0 / S[1.6]["c0"] - 1:+.1e} vs 24x8), switching {lam:.4e} '
          f'({lam / S[1.6]["lam"] - 1:+.1e}), max top-2 memory {d["top_a"].max():.1e}, top buffer {d["top_b"].max():.1e}, '
          f'{float(d["seconds"]):.0f} s', flush=True)
    lam23 = {e: flip_td(T, np.load(RESULTS / 'task2_3' / f'32_12_{e:g}.npz')['a'][0].real) for e in EPS_STRONG[:3]}
    for e in lam23:
        print(f'  eps_Z/g2={e:g}: Task 2.3 run at 32x12 refitted: {lam23[e]:.4e} /us; 24x8 / 32x12 = {S[e]["lam"] / lam23[e]:.4f}',
              flush=True)
        S[e]['lam'] = lam23[e]                   # the converged value where it exists
    k = np.polyfit(np.log(EPS_STRONG[:3]), np.log([lam23[e] - GAMMA_X0[2.1] for e in EPS_STRONG[:3]]), 1)[0]
    print(f'  log slope of the 32x12 switching rate minus Gamma_X(0) over 0.05-0.2 g2 (n = 3): {k:.3f}', flush=True)

    # drive-induced flip coefficient against alpha
    a_all = ALPHAS + [2.1]
    c_all = np.array([c2[a] for a in ALPHAS] + [(lam23[0.1] - GAMMA_X0[2.1]) / (0.1 * G2)**2])
    gd, cc = np.polyfit(np.array(a_all)**2, np.log(c_all), 1)
    gd4 = np.polyfit(np.array(ALPHAS)**2, np.log(c_all[:4]), 1)[0]
    print(f'\n(Gamma_X - Gamma_X(0))/eps_Z^2 at 0.1 g2 (us): ' + ', '.join(f'{a}: {c:.4e}' for a, c in zip(a_all, c_all))
          + f'; ln fit against alpha^2: slope {-gd:.3f} over alpha = 0.8-2.1 (n = 5), {-gd4:.3f} over 0.8-1.4 (n = 4); local '
          f'-dln c/d(alpha^2) between neighbours: ' + ', '.join(f'{x:.3f}' for x in -np.diff(np.log(c_all)) / np.diff(np.array(a_all)**2)),
          flush=True)

    # (b) figure of merit at alpha = 2.1: best total error over tau
    print(f'\nfigure of merit at alpha = 2.1: P(tau) = (1/2) erfc(sqrt(2 kappa_b tau) r) + (1 - exp(-Gamma_X tau))/2, '
          f'minimized over tau (r from 24x8, Gamma_X from 32x12 at 0.05-0.2 g2 and 24x8 above):', flush=True)
    taus = np.logspace(-2, 4, 6001)
    F = {}
    for e in EPS_STRONG:
        gam = S[e]['lam']
        P = p_total(taus, S[e]['c0'], gam)
        j = np.argmin(P)
        F[e] = (taus[j], P[j])
        print(f'  eps_Z/g2={e:g}: best tau = {taus[j]:.3f} us, P = {P[j]:.4e} (misassignment '
              f'{0.5 * erfc(np.sqrt(2 * KB * taus[j]) * S[e]["c0"]):.2e}, flip {0.5 * (1 - np.exp(-gam * taus[j])):.2e}); '
              f'1% window {tau_1(S[e]["c0"]):.3f} us with flip probability {0.5 * (1 - np.exp(-gam * tau_1(S[e]["c0"]))):.2e}',
              flush=True)

    # (c) raise alpha during readout: flip probability of a 1% readout against alpha
    print('\nflip probability over the 1% window at eps_Z = 0.1 g2, linear contrast eps_Z/(2 alpha g2):', flush=True)
    for a, gam in [(a, G[a][EPS.index(0.1)]) for a in ALPHAS] + [(2.1, lam23[0.1])]:
        tau = tau_1(lin(0.1, a))
        print(f'  alpha={a}: tau_1% = {tau:.2f} us, Gamma_X = {gam:.4e} /us, flip probability {0.5 * (1 - np.exp(-gam * tau)):.3e}',
              flush=True)
    R = {}
    for (Na, Nb, e, t) in [(24, 8, 0.2, T), (32, 12, 0.2, T), (36, 14, 0.2, T3), (24, 8, 0.8, T), (32, 12, 0.8, T), (36, 14, 0.8, T3)]:
        d = b_point(2.5, Na, Nb, e, t)
        r, c0, c1 = (lambda rr: (rr, *drift_line(t, rr, 2.0)))((d['b'][1].real - d['b'][0].real) / 2)
        lam, lam23w = flip_td(t, d['a'][0].real), flip_td(t, d['a'][0].real, 2.0, 3.0)
        R[Na, Nb, e] = dict(c0=c0, lam=lam, lam23w=lam23w)
        print(f'  alpha=2.5 {Na}x{Nb} eps_Z/g2={e:g}: half contrast {c0:.6f} (linear {lin(e, 2.5):.6f}, ratio '
              f'{c0 / lin(e, 2.5):.4f}), switching on 3-4 us {lam:.4e} /us (nan if T = 3 us), on 2-3 us {lam23w:.4e} /us, '
              f'1% window {tau_1(c0):.2f} us, flip probability {0.5 * (1 - np.exp(-lam23w * tau_1(c0))):.3e} (2-3 us rate); '
              f'max top-2 memory {d["top_a"].max():.1e}, top buffer {d["top_b"].max():.1e}, {float(d["seconds"]):.0f} s', flush=True)
    for e in (0.2, 0.8):
        print(f'  alpha=2.1 eps_Z/g2={e:g}: 1% window {tau_1(S[e]["c0"]):.2f} us, flip probability '
              f'{0.5 * (1 - np.exp(-S[e]["lam"] * tau_1(S[e]["c0"]))):.3e}', flush=True)
    l32, l36 = R[32, 12, 0.2]['lam23w'], R[36, 14, 0.2]['lam23w']
    print(f'  alpha=2.5 0.2 g2 switching on 2-3 us: 24x8 / 32x12 = {R[24, 8, 0.2]["lam23w"] / l32:.3f}, 36x14 / 32x12 = '
          f'{l36 / l32:.4f}; 0.8 g2: 24x8 / 32x12 = {R[24, 8, 0.8]["lam23w"] / R[32, 12, 0.8]["lam23w"]:.3f}, 36x14 / 32x12 = '
          f'{R[36, 14, 0.8]["lam23w"] / R[32, 12, 0.8]["lam23w"]:.4f}', flush=True)
    for key in [(36, 14, 0.2), (32, 12, 0.8), (36, 14, 0.8)]:
        P = p_total(taus, R[key]['c0'], R[key]['lam23w'])
        j = np.argmin(P)
        print(f'  alpha=2.5 {key[0]}x{key[1]} eps_Z/g2={key[2]:g}: best tau = {taus[j]:.3f} us, P = {P[j]:.4e} (alpha = 2.1 at the '
              f'same drive: {F[key[2]][0]:.3f} us, {F[key[2]][1]:.4e})', flush=True)
    c25 = l36 / (0.2 * G2)**2
    c21 = lam23[0.2] / (0.2 * G2)**2
    print(f'  flip coefficient lambda/eps_Z^2 at 0.2 g2: 2.1 {c21:.4e} us (32x12), 2.5 {c25:.4e} us (36x14), ratio {c25 / c21:.4f}; '
          f'exp(-{-gd:.3f} (2.5^2 - 2.1^2)) = {np.exp(gd * (2.5**2 - 2.1**2)):.4f}; local exponent 2.1-2.5 '
          f'{-np.log(c25 / c21) / (2.5**2 - 2.1**2):.3f}', flush=True)
    # ramp alpha 2.1 -> 2.5 with the readout drive on, and back, mean field
    t = np.linspace(0.0, 4.0, 4001)
    for a0, a1 in ((2.1, 2.5), (2.5, 2.1)):
        am, bm = mean_field(0.0, a0, t, alpha=a1)
        print(f'  mean field, eps_d stepped from alpha = {a0} to {a1}: |a| within 1% of {a1} from {settling_time(t, np.abs(am)):.3f} us',
              flush=True)
    am, bm = mean_field(0.8 * G2, 2.1, t, alpha=2.5)
    print(f'  mean field, step to alpha = 2.5 and 0.8 g2 together from |2.1>: Re b within 1% of its final value from '
          f'{settling_time(t, bm.real):.3f} us (from |2.5>: {settling_time(t, mean_field(0.8 * G2, 2.5, t, alpha=2.5)[1].real):.3f} us)',
          flush=True)

    # (c) shaped turn-on at alpha = 2.1
    (cf, t1f), cost_f, cost_p = fitted_shape()
    cp, t1p = posicast()
    print(f'\nshaped turn-on: pole design c = 1/(1 + e^(-g pi/w)) = {cp:.4f}, t1 = pi/w = {t1p:.4f} us (first-order response '
          f'max deviation after t1 + 0.05 us {cost_p:.2e}); fitted c = {cf:.4f}, t1 = {t1f:.4f} us ({cost_f:.2e})', flush=True)
    for e in (0.1, 1.6):
        st = S[e]
        line = st['c0'] + (st['r'][-1] - st['c0']) / T[-1] * T
        out = [('step', st['r'], st['ts'])]
        for tag in ('pole', 'fit'):
            d = shaped_point(24, 8, e, *((cp, t1p) if tag == 'pole' else (cf, t1f)), tag)
            r = (d['b'][1].real - d['b'][0].real) / 2
            out.append((tag, r, settling_time(T, r, ref=line)))
        for tag, r, ts in out:
            over = (r / line).max() - 1
            sig = {tau: np.trapezoid(r[T <= tau], T[T <= tau]) / (st['c0'] * tau) for tau in (0.5, 1.0, 4.0)}
            print(f'  eps_Z/g2={e:g} {tag}: settles to 1% at {ts:.3f} us, max overshoot {over:+.4f}, integrated signal / '
                  f'(settled value x tau) at tau = 0.5, 1, 4 us: ' + ', '.join(f'{v:.4f}' for v in sig.values()), flush=True)

    # plots
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    ee = np.array(EPS[1:])
    for k, a in enumerate(ALPHAS):
        ax.loglog(ee, G[a][1:], 'o-', color=COLORS[k], lw=2, ms=6, mec='black', label=rf'$\alpha = {a:g}$')
        ax.axhline(G[a][0], color=COLORS[k], ls=':', lw=1.4)
        ax.loglog(EPS_KA0, [eig_point(a, *TRUNC[a], e, ka=0.0)[0] for e in EPS_KA0], 'x', color=COLORS[k], ms=9, mew=1.5)
    ax.loglog(EPS_STRONG[:3], [lam23[e] for e in EPS_STRONG[:3]], 's-', color=COLORS[4], lw=2, ms=6, mec='black',
              label=r'$\alpha = 2.1$ (2.3)')
    ax.loglog(ee, c2[1.4] * (ee * G2)**2, 'k--', lw=1.4, label=r'$\propto\epsilon_Z^2$')
    ax.plot([], [], 'x', color='k', ms=9, mew=1.5, label=r'$\kappa_a = 0$')
    ax.plot([], [], color='k', ls=':', lw=1.4, label=r'$\epsilon_Z = 0$')
    style(ax, r'$\epsilon_Z/g_2$', r'$\Gamma_X$ ($\mu$s$^{-1}$)', r'2.4 Bit-flip rate under the readout drive')
    ax.set_xticks(EPS[1:], [f'{e:g}' for e in EPS[1:]])
    ax.xaxis.set_minor_formatter(plt.NullFormatter())
    ax.legend(fontsize=11, frameon=True, edgecolor='black', loc='lower right')
    plt.tight_layout()
    save(fig, 'task2_4_gamma_eps.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    es = np.array(EPS_STRONG)
    ax.semilogx(es, [S[e]['c0'] / lin(e, 2.1) for e in es], 'o-', color=COLORS[0], lw=2, ms=6, mec='black',
                label=r'$24\times 8$, quasi-steady')
    ax.semilogx(es, [S[e]['mf'] / lin(e, 2.1) for e in es], color='k', ls=':', lw=1.4, label='Mean field')
    ax2 = ax.twinx()
    ax2.loglog(es, [S[e]['lam'] for e in es], 's--', color=COLORS[1], lw=2, ms=6, mec='black')
    ax2.set_ylabel(r'Switching rate $\Gamma_X$ ($\mu$s$^{-1}$)', fontsize=16, color=COLORS[1])
    ax2.tick_params(labelsize=14)
    ax.plot([], [], 's--', color=COLORS[1], lw=2, ms=6, mec='black', label=r'$\Gamma_X$ (right)')
    style(ax, r'$\epsilon_Z/g_2$', r'Half contrast $/\,(\epsilon_Z/2\alpha g_2)$', r'2.4 Contrast at $\alpha = 2.1$')
    ax.legend(fontsize=13, frameon=True, edgecolor='black', loc='center left')
    plt.tight_layout()
    save(fig, 'task2_4_contrast.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for k, e in enumerate([0.1, 0.4, 1.6, 3.2]):
        ax.loglog(taus, p_total(taus, S[e]['c0'], S[e]['lam']), color=COLORS[k], lw=2,
                  label=rf'$\epsilon_Z = {e:g}\,g_2$')
        ax.plot(*F[e], 'o', color=COLORS[k], mec='black', ms=7)
    ax.set_ylim(1e-3, 0.6)
    style(ax, r'Window $\tau$ ($\mu$s)', 'Total readout error', r'2.4 Figure of merit at $\alpha = 2.1$')
    plt.tight_layout()
    save(fig, 'task2_4_fom.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    ax.semilogy(np.array(a_all)**2, c_all, 'o', color=COLORS[0], ms=8, mec='black', label=r'$(\Gamma_X - \Gamma_X^{(0)})/\epsilon_Z^2$')
    x2 = np.linspace(0.5, 6.5, 50)
    ax.semilogy(x2, np.exp(cc + gd * x2), 'k--', lw=1.4, label=rf'$e^{{c - {-gd:.2f}\alpha^2}}$')
    ax.semilogy([6.25], [c25], 's', color=COLORS[1], ms=8, mec='black', label=r'$\alpha = 2.5$, $36\times 14$')
    style(ax, r'$\alpha^2$', r'Flip coefficient ($\mu$s)', r'2.4 Drive-induced flips against $\alpha$')
    plt.tight_layout()
    save(fig, 'task2_4_alpha.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    e = 0.1
    st = S[e]
    ax.axhspan(0.99, 1.01, color='gray', alpha=0.3, lw=0, label=r'$\pm$1%')
    ax.plot(T, st['r'] / st['c0'], color=COLORS[0], lw=2, label='Step')
    for k, tag in enumerate(('pole', 'fit')):
        d = np.load(CACHE / f'shaped_{tag}_24_8_{e:g}.npz')
        ax.plot(T, (d['b'][1].real - d['b'][0].real) / 2 / st['c0'], color=COLORS[k + 1], lw=2,
                label='Two-step, from the pole' if tag == 'pole' else 'Two-step, fitted')
    ax.set_xlim(0, 1.2)
    style(ax, r'$t$ ($\mu$s)', 'Half contrast / quasi-steady', rf'2.4 Shaped turn-on, $\epsilon_Z = {e:g}\,g_2$')
    plt.tight_layout()
    save(fig, 'task2_4_shaping.png')


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    if len(sys.argv) > 1:
        task(int(sys.argv[1]))
    else:
        analyze()
