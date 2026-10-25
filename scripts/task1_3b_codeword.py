"""Task 1.3(b, c) prepare the codeword |0_L> = |+alpha> in the two-mode model.

Method: a memory drive H_x(t) = i eps(t) (e^{i theta} a^dag - e^{-i theta} a) with eps(t) = eps0 sin^2(pi t / T_on) on
0 <= t <= T_on, switched on together with the pump, so it biases the inflation towards +alpha (d<a>/dt = eps e^{i theta}).
Comparison: no drive, but the memory starts in a coherent state |beta> (a displacement pulse before the pump).

Usage: `python scripts/task1_3b_codeword.py run i` solves point i of POINTS and caches it in results/task1_3/;
without arguments it analyses all cached points and makes the plots.
"""
import sys
import time

import dynamiqs as dq
import jax.numpy as jnp
import numpy as np
from scipy.special import erfc, erfcinv

from common import METHOD, COLORS, RESULTS, TWO_PI, alpha, g2, kappa2, kappa_a, kappa_b, save, style, wigner_mosaic
import matplotlib.pyplot as plt

CACHE = RESULTS / 'task1_3'
CACHE.mkdir(exist_ok=True)
T = np.linspace(0.0, 3.0, 601)             # us, the drive is off well before the end
SNAPS = [0.0, 0.05, 0.1, 0.2, 0.5, 3.0]    # us, memory states kept for Wigner plots
TOL = 1e-3                                 # absolute tolerance on F and Re<a>/alpha between truncations
MAIN, CHECK = (32, 12), (40, 16)

# (kind, value, T_on in us, theta in deg, Na, Nb); drive value is eps0/2pi in MHz, start value is beta.
# The list order is the Slurm array index (slurm/task1_3b.sh, 0-33): append new points, never reorder.
AMPS = [1, 2, 4, 8, 12]                    # MHz, at T_on = 0.1 us (EXTRA and the last block add more)
TONS = [0.05, 0.2, 0.4]                    # us, at 4 MHz
PHASES = [30, 60, 90]                      # deg, at 8 MHz and 0.1 us
BETAS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.1]
EXTRA = [(6, 0.1), (10, 0.1), (8, 0.05), (12, 0.05), (16, 0.05)]   # (MHz, us), around the optimum and shorter pulses
POINTS = ([('drive', e, 0.1, 0, *MAIN) for e in AMPS] + [('drive', 4, s, 0, *MAIN) for s in TONS]
          + [('drive', 8, 0.1, p, *MAIN) for p in PHASES] + [('start', b, 0, 0, *MAIN) for b in BETAS]
          + [('drive', 12, 0.1, 0, *CHECK), ('drive', 8, 0.1, 0, *CHECK), ('drive', 4, 0.4, 0, *CHECK),
             ('start', 1.0, 0, 0, *CHECK)]
          + [('drive', e, s, 0, *MAIN) for e, s in EXTRA]
          + [('drive', 10, 0.05, 0, *MAIN), ('drive', 14, 0.05, 0, *MAIN), ('drive', 12, 0.05, 10, *MAIN),
             ('drive', 12, 0.05, 30, *MAIN), ('drive', 12, 0.05, 0, *CHECK), ('drive', 6, 0.1, 0, *CHECK)]
          + [('start', 1.885, 0, 0, *MAIN)])                       # beta = area of the 12 MHz, 0.05 us pulse


def tag(p):
    kind, v, ton, th, Na, Nb = p
    return f'b_{kind}_{v:g}_{ton:g}_{th:g}_{Na}_{Nb}'


def envelope(t, eps0, ton):
    return eps0 * jnp.where(t < ton, jnp.sin(jnp.pi * t / ton)**2, 0.0)


def x_negative(Na):
    """Fock matrix of the projector onto x = Re alpha < 0, <m|Theta(-x)|n> = int_{q<0} psi_m psi_n dq, q = sqrt(2) x."""
    q = np.linspace(-20.0, 0.0, 200001)
    psi = np.zeros((Na, q.size))
    psi[0] = np.pi**-0.25 * np.exp(-q**2 / 2)
    psi[1] = np.sqrt(2) * q * psi[0]
    for n in range(1, Na - 1):             # Hermite-function recursion
        psi[n + 1] = np.sqrt(2 / (n + 1)) * q * psi[n] - np.sqrt(n / (n + 1)) * psi[n - 1]
    w = np.full(q.size, q[1] - q[0])
    w[[0, -1]] /= 2                        # trapezoid weights
    return (psi * w) @ psi.T


def cats(Na):
    """|C+> and |C->; together they span the code space."""
    return [np.asarray((dq.coherent(Na, alpha) + s * dq.coherent(Na, -alpha)).unit().to_jax()[:, 0]) for s in (1, -1)]


def run(i):
    p = POINTS[i]
    f = CACHE / f'{tag(p)}.npz'
    if f.exists():                         # checkpoint: skip finished points
        return dict(np.load(f))
    kind, v, ton, th, Na, Nb = p
    a, b = dq.destroy(Na, Nb)
    H = g2 * (a @ a @ b.dag()) + g2 * (a.dag() @ a.dag() @ b) - alpha**2 * g2 * (b + b.dag())
    beta = 0.0
    if kind == 'drive':
        eps0, ph = TWO_PI * v, np.exp(1j * np.deg2rad(th))
        H = H + dq.modulated(lambda t: envelope(t, eps0, ton), 1j * (ph * a.dag() - np.conj(ph) * a),
                             discontinuity_ts=[ton])
    else:
        beta = v
    t0 = time.time()
    res = dq.mesolve(H, [jnp.sqrt(kappa_b) * b, jnp.sqrt(kappa_a) * a], dq.tensor(dq.coherent(Na, beta), dq.fock(Nb, 0)),
                     T, method=METHOD, save_states=False, progress_meter=False,
                     save_extra=lambda _, rho: (dq.ptrace(rho, 0).to_jax(), jnp.diagonal(dq.ptrace(rho, 1).to_jax()).real))
    rho_a, pb = (np.asarray(x) for x in res.extra)
    am = np.asarray(dq.destroy(Na).to_jax())
    plus = np.asarray(dq.coherent(Na, alpha).to_jax()[:, 0])
    cp, cm = cats(Na)
    sand = lambda u: np.einsum('i,tij,j->t', u.conj(), rho_a, u).real
    pa = np.real(np.diagonal(rho_a, axis1=1, axis2=2))
    mean_a = np.einsum('tij,ji->t', rho_a, am)
    d = dict(t=T, re_a=mean_a.real, im_a=mean_a.imag, n_a=pa @ np.arange(Na), n_b=pb @ np.arange(Nb),
             F=sand(plus), P=pa @ (-1.0)**np.arange(Na), code=sand(cp) + sand(cm),
             p_neg=np.einsum('tij,ji->t', rho_a, x_negative(Na)).real, top_a=pa[:, -2:].sum(1), top_b=pb[:, -1],
             snaps=rho_a[[int(round(s / (T[1] - T[0]))) for s in SNAPS]], seconds=time.time() - t0)
    np.savez(f, **d)
    print(f'{tag(p)}: F = {d["F"][-1]:.5f}, Re<a>/alpha = {d["re_a"][-1] / alpha:.5f}, {d["seconds"]:.0f} s, wrote {f}',
          flush=True)
    return d


def since(t, ok):
    """First time from which the condition ok holds up to the end (nan if it fails at the end)."""
    bad = np.nonzero(~ok)[0]
    return t[0] if not len(bad) else (t[bad[-1] + 1] if bad[-1] + 1 < len(t) else np.nan)


def analyse():
    R = {p: run(i) for i, p in enumerate(POINTS)}
    ceil = R[('start', 2.1, 0, 0, *MAIN)]
    a_ss = np.sqrt(ceil['n_a'][-1])
    print(f'ceiling, memory starts in |alpha = 2.1>: F(3 us) = {ceil["F"][-1]:.6f} (1 - F = {1 - ceil["F"][-1]:.1e}), '
          f'Re<a>(3 us) = {ceil["re_a"][-1]:.5f}, n_a(3 us) = {ceil["n_a"][-1]:.4f}; a coherent state of amplitude '
          f'sqrt(n_a) = {a_ss:.5f} has |<alpha|.>|^2 = {np.exp(-(alpha - a_ss)**2):.6f}', flush=True)
    eps_c = 2 * kappa2 * alpha**3 / (3 * np.sqrt(3))
    print(f'static threshold where the -alpha well vanishes, eps_c = 2 kappa2 alpha^3/(3 sqrt 3) = {eps_c:.2f} rad/us '
          f'= 2pi x {eps_c / TWO_PI:.3f} MHz', flush=True)
    vac = vacuum_reference()
    print(f'no drive, vacuum start (Task 1.1 run, same grid): F = {vac["F"][-1]:.5f}, Re<a>/alpha = '
          f'{vac["re_a"][-1] / alpha:+.5f}, p(x<0) = {vac["p_neg"][-1]:.5f}, max n_a {vac["n_a"].max():.2f}, '
          f'code-space population >= 0.99 from {since(vac["t"], vac["code"] >= 0.99):.3f} us', flush=True)

    print('point                      area   F(3us)      1-F      Re<a>/a     p(x<0) p(x<0,t=0) erfc(sqrt2 b)/2  b_eff  '
          'max n_a  code(us)  settle(us)  top_a    top_b', flush=True)
    for p, d in R.items():
        kind, v, ton, th, Na, Nb = p
        area = TWO_PI * v * ton / 2 if kind == 'drive' else v
        pred = erfc(np.sqrt(2) * v) / 2 if kind == 'start' else np.nan
        pn = d['p_neg'][-1]
        b_eff = erfcinv(2 * pn) / np.sqrt(2) if 0 < pn < 0.5 else np.nan
        print(f'{tag(p)[2:]:26s} {area:5.3f} {d["F"][-1]:9.6f} {1 - d["F"][-1]:9.2e} {d["re_a"][-1] / alpha:9.6f} '
              f'{pn:9.2e} {d["p_neg"][0]:9.2e} {pred:12.2e}  {b_eff:6.3f}  {d["n_a"].max():6.2f}  '
              f'{since(T, d["code"] >= 0.99):7.3f}  {since(T, np.abs(d["re_a"] - d["re_a"][-1]) <= 0.01 * alpha):8.3f}  {d["top_a"].max():8.1e} '
              f'{d["top_b"].max():8.1e}', flush=True)

    i1 = int(np.argmin(np.abs(T - 1.0)))
    print(f'over all {len(R)} runs: max |1 - F - p(x<0)| at 3 us = '
          f'{max(abs(1 - d["F"][-1] - d["p_neg"][-1]) for d in R.values()):.1e}, max |p(x<0)(1 us) - p(x<0)(3 us)| = '
          f'{max(abs(d["p_neg"][i1] - d["p_neg"][-1]) for d in R.values()):.1e}', flush=True)
    print(f'truncation check, {MAIN[0]} x {MAIN[1]} against {CHECK[0]} x {CHECK[1]} (tolerance {TOL:g}):', flush=True)
    for p in [q for q in POINTS if q[4:] == CHECK]:
        d, dm = R[p], R[p[:4] + MAIN]
        dF, dR = abs(d['F'][-1] - dm['F'][-1]), abs(d['re_a'][-1] - dm['re_a'][-1]) / alpha
        dmax = max(np.abs(d['F'] - dm['F']).max(), np.abs(d['re_a'] - dm['re_a']).max() / alpha)
        k = int(d['re_a'].argmax())
        print(f'  {tag(p)[2:-6]}: |dF(3 us)| = {dF:.1e}, |d Re<a>/alpha (3 us)| = {dR:.1e}, max over all times {dmax:.1e} '
              f'({"within" if dmax < TOL else "ABOVE"} {TOL:g}); {CHECK[0]} x {CHECK[1]}: Re<a>/alpha max {d["re_a"][k] / alpha:.3f}, '
              f'min after it {d["re_a"][k:].min() / alpha:.3f}', flush=True)

    for ton in (0.05, 0.1):
        for e, d in zip(*series(R, ton)):
            i_on, k = int(round(ton / (T[1] - T[0]))), int(d['re_a'].argmax())
            j = k + int(d['re_a'][k:].argmin())
            print(f'T_on {ton:g} us, {e:g} MHz: p(x<0) at T_on {d["p_neg"][i_on]:.2e}, at 0.15 us '
                  f'{d["p_neg"][np.isclose(T, 0.15)][0]:.2e}, at 0.3 us {d["p_neg"][np.isclose(T, 0.3)][0]:.2e}, '
                  f'at 1 us {d["p_neg"][np.isclose(T, 1.0)][0]:.2e}, at 3 us {d["p_neg"][-1]:.2e}; Re<a>/alpha max '
                  f'{d["re_a"][k] / alpha:.3f} at {T[k]:.3f} us, min after it {d["re_a"][j] / alpha:.3f} at {T[j]:.3f} us',
                  flush=True)
    best = max((p for p in R if p[4:] == MAIN and p[0] == 'drive'), key=lambda p: R[p]['F'][-1])
    print(f'best drive point: {tag(best)[2:]}, F = {R[best]["F"][-1]:.5f}, wrong-well p(x<0) = {R[best]["p_neg"][-1]:.2e}, '
          f'ceiling 1 - F = {1 - ceil["F"][-1]:.1e}', flush=True)
    same = ('drive', round(best[1] * best[2] / 0.1, 6), 0.1, 0, *MAIN)          # same pulse area spread over 0.1 us
    if same in R:
        print(f'same area over 0.1 us ({tag(same)[2:]}): 1 - F = {1 - R[same]["F"][-1]:.2e}, '
              f'{(1 - R[same]["F"][-1]) / (1 - R[best]["F"][-1]):.2f} times the best pulse', flush=True)
    print(f'a displacement before the pump with the best pulse envelope (sin^2, peak {best[1]:g} MHz) reaches beta = alpha '
          f'in 2 alpha / eps0 = {2 * alpha / (TWO_PI * best[1]):.4f} us', flush=True)
    lp = np.log([R[('start', b, 0, 0, *MAIN)]['p_neg'][-1] for b in starts(R)])     # decreasing in beta
    print(f'simulated starts reach the best pulse p(x<0) at beta = '
          f'{np.interp(-np.log(R[best]["p_neg"][-1]), -lp, starts(R)):.2f} (log-linear interpolation between starts)', flush=True)
    ratios = {b: R[('start', b, 0, 0, *MAIN)]['p_neg'][-1] / (erfc(np.sqrt(2) * b) / 2) for b in starts(R)}
    print('start in |beta>, p(x<0) / (erfc(sqrt2 beta)/2): ' + ', '.join(f'{b:g}: {r:.3f}' for b, r in ratios.items()),
          flush=True)
    plot(R, ceil, vac)


def vacuum_reference():
    """Task 1.1 setting on the 3 us grid of this script, from the Task 1.1 cache (32 x 12, same tolerances)."""
    d = np.load(RESULTS / 'task1_1.npz')
    rho_a = d['rho_a']
    plus = np.asarray(dq.coherent(int(d['Na']), alpha).to_jax()[:, 0])
    am = np.asarray(dq.destroy(int(d['Na'])).to_jax())
    return dict(t=d['t'], F=np.einsum('i,tij,j->t', plus.conj(), rho_a, plus).real, re_a=np.einsum('tij,ji->t', rho_a, am).real,
                p_neg=np.einsum('tij,ji->t', rho_a, x_negative(int(d['Na']))).real,
                code=sum(np.einsum('i,tij,j->t', c.conj(), rho_a, c).real for c in cats(int(d['Na']))), n_a=d['n_a'])


def starts(R):
    """beta values of the coherent starts at the main truncation, sorted."""
    return sorted(p[1] for p in R if p[0] == 'start' and p[4:] == MAIN)


def series(R, ton):
    """Drive points at one on-time, theta = 0, main truncation, sorted by amplitude."""
    ps = sorted((p for p in R if p[0] == 'drive' and p[2] == ton and p[3] == 0 and p[4:] == MAIN), key=lambda p: p[1])
    return [p[1] for p in ps], [R[p] for p in ps]


def plot(R, ceil, vac):
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    bb = np.linspace(0, 2.2, 200)
    ax.semilogy(bb, erfc(np.sqrt(2) * bb) / 2, color='k', ls='--', lw=1.4, label=r'erfc$(\sqrt{2}\beta)/2$')
    ax.semilogy(starts(R), [R[('start', x, 0, 0, *MAIN)]['p_neg'][-1] for x in starts(R)], 'o', color=COLORS[0], ms=7,
                mec='black', label=r'Start in $|\beta\rangle$')
    for k, ton in enumerate((0.05, 0.1)):
        amps, ds = series(R, ton)
        ax.semilogy([TWO_PI * e * ton / 2 for e in amps], [d['p_neg'][-1] for d in ds], 's^'[k], color=COLORS[k + 1],
                    ms=7, mec='black', lw=1, ls='-', label=rf'Drive, $T_{{on}}$ = {ton:g} $\mu$s')
    ax.set_ylim(1e-6, 1)
    style(ax, r'$\beta$ or pulse area $\int\epsilon\,dt$', r'Wrong-well weight $p(x<0)$ at 3 $\mu$s',
          '1.3(b) Biasing the inflation')
    ax.legend(fontsize=11, frameon=True, edgecolor='black')
    plt.tight_layout()
    save(fig, 'task1_3b_wrong_well.png')

    amps, ds = zip(*[(e, d) for e, d in zip(*series(R, 0.05)) if e != 14])   # five curves, one per house color
    for key, ylabel, name, title, log in (('re_a', r'Re$\langle a\rangle/\alpha$', 'task1_3b_re_a.png', 'Mean field', False),
                                          ('p_neg', r'Wrong-well weight $p(x<0)$', 'task1_3b_p_neg.png',
                                           r'Weight on Re $\alpha < 0$', True)):
        fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
        for k, (e, d) in enumerate(zip(amps, ds)):
            y = d[key] / alpha if key == 're_a' else d[key]
            (ax.semilogy if log else ax.plot)(T, y, color=COLORS[k], lw=2, label=rf'$\epsilon_0/2\pi$ = {e:g} MHz')
        y = vac[key] / alpha if key == 're_a' else vac[key]
        (ax.semilogy if log else ax.plot)(vac['t'], y, color='gray', lw=1.4, ls=':', label='No drive')
        if not log:
            ax.axhline(1, color='k', ls='--', lw=1.4)
        ax.axvspan(0, 0.05, color='gray', alpha=0.15, lw=0)
        ax.set_xlim(0, 1.5)
        if log:
            ax.set_ylim(1e-7, 1)
        style(ax, r'$t$ ($\mu$s)', ylabel, rf'1.3(b) {title}, $T_{{on}}$ = 0.05 $\mu$s')
        ax.legend(fontsize=10, frameon=True, edgecolor='black', ncol=2, loc='lower right')
        plt.tight_layout()
        save(fig, name)

    d = R[('drive', 12, 0.05, 0, *MAIN)]
    wigner_mosaic(list(d['snaps']), SNAPS, 'task1_3b_wigner.png',
                  r'1.3(b) Memory Wigner function, 12 MHz drive for 0.05 $\mu$s', xmax=4.0, ncols=3)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'run':
        run(int(sys.argv[2]))
    else:
        analyse()
