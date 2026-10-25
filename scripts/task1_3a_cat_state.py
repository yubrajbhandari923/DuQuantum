"""Task 1.3(a) which state the two-mode inflation prepares: parity, fidelity with |C_+>, purity and fringes over 10 us.

Usage: `python scripts/task1_3a_cat_state.py run Na Nb [T] [ka0]` solves one truncation (ka0: kappa_a = 0) and caches it
in results/task1_3/; without arguments it analyses the cached 32 x 12 runs, compares them with 40 x 16 and makes the plots.
"""
import sys
import time

import dynamiqs as dq
import jax.numpy as jnp
import numpy as np
from scipy.optimize import curve_fit

from common import METHOD, COLORS, RESULTS, alpha, g2, kappa_a, kappa_b, save, style, wigner_mosaic
import matplotlib.pyplot as plt

CACHE = RESULTS / 'task1_3'
CACHE.mkdir(exist_ok=True)
T_END, DT = 10.0, 0.005                    # us; 2001 saved times
MAIN, CHECK = (32, 12), (40, 16)           # converged truncation of Task 1.2 and the larger check
FIT_T0 = 2.0                               # us, start of the parity fit window, after the inflation transient
TOL = 1e-3                                 # absolute tolerance for the truncation check of the quoted quantities


def run(Na, Nb, T=T_END, loss=True):
    f = CACHE / f'a_{Na}_{Nb}_{T:g}{"" if loss else "_ka0"}.npz'
    if f.exists():                         # checkpoint: skip finished runs
        return dict(np.load(f))
    a, b = dq.destroy(Na, Nb)
    H = g2 * (a @ a @ b.dag()) + g2 * (a.dag() @ a.dag() @ b) - alpha**2 * g2 * (b + b.dag())
    t = jnp.linspace(0.0, T, int(round(T / DT)) + 1)
    t0 = time.time()

    def extra(_, rho):                     # reduced states and joint purity; full states would not fit in memory
        r = rho.to_jax()
        return dq.ptrace(rho, 0).to_jax(), dq.ptrace(rho, 1).to_jax(), jnp.sum(jnp.abs(r)**2)

    jumps = [jnp.sqrt(kappa_b) * b] + ([jnp.sqrt(kappa_a) * a] if loss else [])
    res = dq.mesolve(H, jumps, dq.tensor(dq.fock(Na, 0), dq.fock(Nb, 0)), t,
                     method=METHOD, save_states=False, save_extra=extra, progress_meter=False)
    rho_a, rho_b, pur_ab = (np.asarray(x) for x in res.extra)
    d = dict(t=np.asarray(t), rho_a=rho_a, rho_b=rho_b, pur_ab=pur_ab.real, Na=Na, Nb=Nb, seconds=time.time() - t0)
    np.savez(f, **d)
    print(f'Na={Na} Nb={Nb} T={T:g} us kappa_a {"on" if loss else "0"}: {d["seconds"]:.0f} s, wrote {f}', flush=True)
    return d


def cat(Na, sign):
    return (dq.coherent(Na, alpha) + sign * dq.coherent(Na, -alpha)).unit().to_jax()[:, 0]


def observables(d):
    rho_a, Na = d['rho_a'], int(d['Na'])
    n = np.arange(Na)
    pa = np.real(np.diagonal(rho_a, axis1=1, axis2=2))
    pb = np.real(np.diagonal(d['rho_b'], axis1=1, axis2=2))
    cp, cm = np.asarray(cat(Na, +1)), np.asarray(cat(Na, -1))
    ap, am = (np.asarray(dq.coherent(Na, s * alpha).to_jax()[:, 0]) for s in (1, -1))
    sand = lambda u, v: np.einsum('i,tij,j->t', u.conj(), rho_a, v)
    return dict(t=d['t'], n_a=pa @ n, n_b=pb @ np.arange(int(d['Nb'])), P=pa @ (-1.0)**n, nP=pa @ (n * (-1.0)**n),
                F=sand(cp, cp).real, Fm=sand(cm, cm).real, coh=sand(ap, am).real,
                pur_a=np.sum(np.abs(rho_a)**2, axis=(1, 2)), pur_b=np.sum(np.abs(d['rho_b'])**2, axis=(1, 2)),
                pur_ab=d['pur_ab'], top_a=pa[:, -2:].sum(1), top_b=pb[:, -1])


def since(t, ok):
    """First time from which the condition ok holds up to the end (nan if it fails at the end)."""
    bad = np.nonzero(~ok)[0]
    return t[0] if not len(bad) else (t[bad[-1] + 1] if bad[-1] + 1 < len(t) else np.nan)


def analyse():
    d, dc = run(*MAIN), run(*CHECK)
    z, zc = run(*MAIN, 3.0, False), run(*CHECK, 3.0, False)      # kappa_a = 0, 3 us
    o, oc, oz, ozc = (observables(x) for x in (d, dc, z, zc))
    t, tz = o['t'], oz['t']
    e2 = np.exp(-2 * alpha**2)
    for x, name in ((d, 'kappa_a on, 10 us'), (dc, 'kappa_a on, 10 us'), (z, 'kappa_a = 0, 3 us'), (zc, 'kappa_a = 0, 3 us')):
        print(f'run {int(x["Na"])} x {int(x["Nb"])}, {name}: {float(x["seconds"]):.0f} s, {len(x["t"])} saved times', flush=True)

    # truncation: top levels at every saved time, and the quoted quantities at the larger truncation
    m, c = f'{MAIN[0]}x{MAIN[1]}', f'{CHECK[0]}x{CHECK[1]}'
    for name, x in ((m, o), (c, oc), (f'{m} kappa_a = 0', oz), (f'{c} kappa_a = 0', ozc)):
        print(f'truncation {name}: max memory top-2 population {x["top_a"].max():.2e}, '
              f'max buffer top population {x["top_b"].max():.2e} at {x["t"][x["top_b"].argmax()]:.3f} us', flush=True)
    for x, y, name in ((o, oc, 'kappa_a on'), (oz, ozc, 'kappa_a = 0')):
        for win, w in (('t < 2 us', x['t'] < FIT_T0), ('t >= 2 us', x['t'] >= FIT_T0)):
            if not w.any():
                continue
            devs = {k: np.abs(x[k] - y[k])[w].max() for k in ('P', 'F', 'pur_a', 'pur_ab', 'coh')}
            devs['n_a (relative)'] = (np.abs(x['n_a'] - y['n_a']) / np.maximum(y['n_a'], 1))[w].max()
            print(f'  {name}, {win} (n = {w.sum()}), max |{m} - {c}|: ' + ', '.join(f'{k} {v:.1e}' for k, v in devs.items())
                  + f' ({"all within" if max(devs.values()) < TOL else "ABOVE"} {TOL:g})', flush=True)

    # kappa_a = 0: parity is exactly conserved and the state goes to |C+>; transient numbers at both truncations,
    # since before 2 us they differ in the fourth digit
    print(f'kappa_a = 0: max |<P> - 1| = {np.abs(oz["P"] - 1).max():.1e}; at 3 us F(C+) = {oz["F"][-1]:.6f} '
          f'(1 - F = {1 - oz["F"][-1]:.1e}), purity {oz["pur_a"][-1]:.6f}, n_a {oz["n_a"][-1]:.4f} '
          f'(|C+> has alpha^2 tanh(alpha^2) = {alpha**2 * np.tanh(alpha**2):.4f})', flush=True)
    s2 = lambda p: -np.log(p)              # Renyi-2 entropy from a purity
    for name, x, xz in ((m, o, oz), (c, oc, ozc)):
        i, k = int(np.argmin(xz['pur_a'])), int(np.argmax(x['F']))
        mi = s2(xz['pur_a'][i]) + s2(xz['pur_b'][i]) - s2(xz['pur_ab'][i])
        gap = (1 + x['P']**2) / 2 - x['pur_a']
        j, early = int(np.argmax(gap)), t <= 1.5
        print(f'{name} kappa_a = 0: F(C+) at 0.5, 1, 2 us = ' + ', '.join(f'{xz["F"][int(round(s / DT))]:.5f}' for s in (0.5, 1.0, 2.0))
              + f'; 1 - F(3 us) = {1 - xz["F"][-1]:.1e}; memory purity min {xz["pur_a"][i]:.4f} at {tz[i]:.3f} us, there '
              f'memory and buffer Tr rho^2 = {xz["pur_ab"][i]:.4f}, buffer Tr rho_b^2 = {xz["pur_b"][i]:.4f}, '
              f'n_b = {xz["n_b"][i]:.3f}, Renyi-2 S(a) = {s2(xz["pur_a"][i]):.3f}, S(b) = {s2(xz["pur_b"][i]):.3f}, '
              f'S(ab) = {s2(xz["pur_ab"][i]):.3f}, mutual information S(a) + S(b) - S(ab) = {mi:.3f}; n_b peak '
              f'{xz["n_b"].max():.3f} at {tz[xz["n_b"].argmax()]:.3f} us; memory purity > 0.99 from '
              f'{since(tz, xz["pur_a"] > 0.99):.3f} us', flush=True)
        print(f'{name} kappa_a on: max F(C+) = {x["F"][k]:.4f} at {t[k]:.3f} us; memory purity min '
              f'{x["pur_a"][early].min():.4f} at {t[np.argmin(x["pur_a"][early])]:.3f} us; largest gap below '
              f'(1 + <P>^2)/2 is {gap[j]:.4f} at {t[j]:.3f} us; gap < 0.01 from {since(t, gap < 0.01):.3f} us', flush=True)

    # mixture references and the state at a few times
    print(f'equal mixture of |+alpha>, |-alpha>: <P> = e^(-2 alpha^2) = {e2:.2e}, purity = (1 + e^(-4 alpha^2))/2 = '
          f'{(1 + e2**2) / 2:.6f}, fidelity with |C+> = (1 + e^(-2 alpha^2))/2 = {(1 + e2) / 2:.6f}, '
          f'<alpha|rho|-alpha> = {e2:.2e}', flush=True)
    print(f'pure |C+>: <P> = 1, purity 1, <alpha|rho|-alpha> = (1 + e^(-2 alpha^2))/2 = {(1 + e2) / 2:.6f}', flush=True)
    snaps, w0s = [0.0, 0.2, 0.5, 1.0, 2.0, 4.0, 6.0, 10.0], {}
    for name, x, ox in ((m, d, o), (c, dc, oc)):
        print(f'{name}:  t (us)   <P>      F(C+)    F(C-)   purity  (1+P^2)/2  <a|rho|-a>  (P+e^-2a^2)/2  W(0)  (2/pi)<P>  n_a',
              flush=True)
        w = {}
        for s in snaps:
            i = int(round(s / DT))
            w[s] = float(dq.wigner(x['rho_a'][i], xvec=jnp.array([0.0]), yvec=jnp.array([0.0]))[2][0, 0])
            print(f'  {s:5.1f}  {ox["P"][i]:8.5f} {ox["F"][i]:8.5f} {ox["Fm"][i]:8.5f} {ox["pur_a"][i]:8.5f} '
                  f'{(1 + ox["P"][i]**2) / 2:8.5f}  {ox["coh"][i]:9.5f}  {(ox["P"][i] + e2) / 2:9.5f}    {w[s]:7.4f} '
                  f'{2 / np.pi * ox["P"][i]:7.4f}  {ox["n_a"][i]:.4f}', flush=True)
        w0s[name] = w
    late = t >= FIT_T0
    print(f'late times (t >= {FIT_T0:g} us, n = {late.sum()}): max |purity - (1 + <P>^2)/2| = '
          f'{np.abs(o["pur_a"] - (1 + o["P"]**2) / 2)[late].max():.1e}, max |F(C+) + F(C-) - 1| = '
          f'{np.abs(o["F"] + o["Fm"] - 1)[late].max():.1e}, max |<alpha|rho|-alpha> - (<P> + e^(-2 alpha^2))/2| = '
          f'{np.abs(o["coh"] - (o["P"] + e2) / 2)[late].max():.1e}', flush=True)

    # exact parity identity d<P>/dt = -2 kappa_a <n P>, and the exponential fit with the floor 1/cosh(2 alpha^2)
    dPdt = np.gradient(o['P'], t)
    mid = (t > 0.05) & (t < T_END - 0.05)
    print(f'identity d<P>/dt = -2 kappa_a <n P>: max deviation {np.abs(dPdt + 2 * kappa_a * o["nP"])[mid].max() / np.abs(dPdt[mid]).max():.1e} '
          f'of max |d<P>/dt| (central differences, n = {mid.sum()})', flush=True)
    model = lambda s, A, G, C: A * np.exp(-G * s) + C
    fits = [curve_fit(model, t[late], x['P'][late], p0=(1.0, 0.5, 0.0)) for x in (o, oc)]
    amp, gam, floor = fits[0][0]
    resid = o['P'][late] - model(t[late], amp, gam, floor)
    gam_c, floor_c = fits[1][0][1:]
    n_late = o['n_a'][late].mean()
    c_ideal = 1 / np.cosh(2 * alpha**2)
    print(f'parity fit <P> = A exp(-Gamma t) + C on {FIT_T0:g} to {T_END:g} us (n = {late.sum()}): Gamma = {gam:.5f} '
          f'/us, 1/Gamma = {1 / gam:.4f} us, A = {amp:.5f}, C = {floor:.4e} '
          f'(1/cosh(2 alpha^2) = {c_ideal:.3e}, C/that = {floor / c_ideal:.3f}), max |residual| = {np.abs(resid).max():.1e}; '
          f'{CHECK[0]}x{CHECK[1]}: Gamma = {gam_c:.5f} /us (relative change {abs(gam_c - gam) / gam:.1e}), C = {floor_c:.4e}',
          flush=True)
    for t0 in (3.0, 4.0):                  # the floor must not depend on the window if it is the steady parity
        w = t >= t0
        print(f'  window {t0:g} to {T_END:g} us (n = {w.sum()}): C = {curve_fit(model, t[w], o["P"][w], p0=(1.0, 0.5, 0.0))[0][2]:.4e}',
              flush=True)
    g_fix = curve_fit(lambda s, A, G: A * np.exp(-G * s) + c_ideal, t[late], o['P'][late], p0=(1.0, 0.5))[0][1]
    print(f'  with C fixed at 1/cosh(2 alpha^2): Gamma = {g_fix:.6f} /us against {gam:.6f} '
          f'(relative change {abs(g_fix - gam) / gam:.1e})', flush=True)
    print(f'  mean <n_a> in window = {n_late:.4f}; 2 kappa_a <n_a> = {2 * kappa_a * n_late:.5f} /us '
          f'(1/ = {1 / (2 * kappa_a * n_late):.4f} us, Gamma/(2 kappa_a <n>) = {gam / (2 * kappa_a * n_late):.5f}); '
          f'2 kappa_a alpha^2 = {2 * kappa_a * alpha**2:.5f} /us (1/ = {1 / (2 * kappa_a * alpha**2):.4f} us, '
          f'Gamma/(2 kappa_a alpha^2) = {gam / (2 * kappa_a * alpha**2):.5f})', flush=True)
    half = t[np.nonzero(o['P'] < 0.5)[0][0]]
    efold = t[np.nonzero(o['P'] < np.exp(-1))[0][0]]
    print(f'superposition criterion <P> > 1/2 (the pure |C+> weight in rho = <P>|C+><C+| + (1 - <P>) rho_mix) '
          f'holds until t = {half:.3f} us (fit: ln(A/(1/2 - C))/Gamma = {np.log(amp / (0.5 - floor)) / gam:.3f} us); '
          f'<P> < 1/e from t = {efold:.3f} us; <P>(10 us) = {o["P"][-1]:.4f}', flush=True)

    plot(d, o, oc, oz, (amp, gam, floor), w0s[m])
    np.savez(RESULTS / 'task1_3a.npz', **o, Gamma=gam, A=amp, C=floor, **{f'{k}_check': v for k, v in oc.items()},
             **{f'{k}_ka0': v for k, v in oz.items()})
    print(f'wrote {RESULTS / "task1_3a.npz"}', flush=True)


def plot(d, o, oc, oz, fit, w0):
    t, tz = o['t'], oz['t']
    amp, gam, floor = fit
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    ax.plot(t, o['P'], color=COLORS[0], lw=2, label=r'$\langle P\rangle$')
    ax.plot(t, o['F'], color=COLORS[1], lw=2, label=r'Fidelity with $|\mathcal{C}_+\rangle$')
    ax.plot(t, o['pur_a'], color=COLORS[2], lw=2, label=r'Purity Tr $\rho_a^2$')
    ax.plot(tz, oz['F'], color=COLORS[4], lw=2, ls='-.', label=r'Fidelity, $\kappa_a = 0$')
    ax.plot(t, (1 + o['P']**2) / 2, color='k', ls='--', lw=1.4, label=r'$(1 + \langle P\rangle^2)/2$')
    ax.axhline(0.5, color='gray', ls=':', lw=1.4, label='Equal mixture (fidelity, purity)')
    ax.set_ylim(0, 1.05)
    style(ax, r'$t$ ($\mu$s)', 'Value', '1.3(a) Even cat from vacuum')
    ax.legend(fontsize=11, frameon=True, edgecolor='black')
    plt.tight_layout()
    save(fig, 'task1_3a_cat_quantities.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    ax.plot(tz, oz['pur_a'], color=COLORS[0], lw=2, label=r'Memory Tr $\rho_a^2$, $\kappa_a = 0$')
    ax.plot(tz, oz['pur_ab'], color=COLORS[1], lw=2, label=r'Memory and buffer Tr $\rho^2$, $\kappa_a = 0$')
    ax.plot(tz, oz['F'], color=COLORS[2], lw=2, label=r'Fidelity with $|\mathcal{C}_+\rangle$, $\kappa_a = 0$')
    ax.plot(t, o['pur_a'], color=COLORS[3], lw=2, label=r'Memory Tr $\rho_a^2$')
    ax.plot(t, (1 + o['P']**2) / 2, color='k', ls='--', lw=1.4, label=r'$(1 + \langle P\rangle^2)/2$')
    ax.set_xlim(0, 1.5)
    ax.set_ylim(0, 1.05)
    style(ax, r'$t$ ($\mu$s)', 'Purity or fidelity', '1.3(a) Purity during inflation')
    ax.legend(fontsize=10, frameon=True, edgecolor='black')
    plt.tight_layout()
    save(fig, 'task1_3a_purity_transient.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    ax.semilogy(t, o['P'], color=COLORS[0], lw=2, label=rf'$\langle P\rangle$, $N_a, N_b$ = {MAIN[0]}, {MAIN[1]}')
    ax.semilogy(t[::50], oc['P'][::50], 'o', color=COLORS[1], ms=5, mec='black', label=f'{CHECK[0]}, {CHECK[1]}')
    tf = t[t >= FIT_T0]
    ax.semilogy(tf, amp * np.exp(-gam * tf) + floor, color='k', ls='--', lw=1.4,
                label=rf'Fit, $1/\Gamma$ = {1 / gam:.3f} $\mu$s')
    ax.semilogy(t, np.exp(-2 * kappa_a * alpha**2 * t), color='gray', ls=':', lw=1.4,
                label=r'$e^{-2\kappa_a\alpha^2 t}$')
    style(ax, r'$t$ ($\mu$s)', r'$\langle P\rangle$', '1.3(a) Parity decay')
    plt.tight_layout()
    save(fig, 'task1_3a_parity_fit.png')

    snaps = list(w0)
    wigner_mosaic([d['rho_a'][int(round(s / DT))] for s in snaps], snaps, 'task1_3a_wigner.png',
                  '1.3(a) Memory Wigner function from vacuum', xmax=3.5, ncols=4)

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    y = jnp.linspace(-2.0, 2.0, 401)
    for k, s in enumerate((1.0, 2.0, 4.0, 6.0, 10.0)):
        w = dq.wigner(d['rho_a'][int(round(s / DT))], xvec=jnp.array([0.0]), yvec=y)[2][0]
        ax.plot(y, w, color=COLORS[k], lw=2, label=rf'$t$ = {s:g} $\mu$s')
    ax.axhline(0, color='k', lw=0.8)
    style(ax, r'Im $\alpha$ (at Re $\alpha$ = 0)', r'$W$', '1.3(a) Fringes between the blobs')
    plt.tight_layout()
    save(fig, 'task1_3a_fringes.png')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'run':
        run(int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4]) if len(sys.argv) > 4 else T_END, 'ka0' not in sys.argv)
    else:
        analyse()
