"""Task 2.2 phase-flip rate: parity decay of the even cat in the full two-mode model, fitted at each alpha."""
import sys
import time

import dynamiqs as dq
import jax.numpy as jnp
import numpy as np
import scipy.sparse as sp
from scipy.optimize import curve_fit
from scipy.sparse.linalg import LinearOperator, eigs, expm_multiply

from common import METHOD, COLORS, RESULTS, g2, kappa_a, kappa_b, save, style
import matplotlib.pyplot as plt

ALPHAS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.1, 2.5, 3.0]
NA = {1.0: 16, 1.25: 16, 1.5: 16, 1.75: 20, 2.0: 20, 2.1: 24, 2.5: 28, 3.0: 36}  # base memory truncation
NB, DNA, DNB = 4, 8, 4             # base buffer truncation; the check reruns at N_a + DNA and at N_b + DNB
QUICK = 'quick' in sys.argv        # login-node slice: four alphas, a tenth of the time, own cache
NT, T0 = 601, 0.02 if QUICK else 0.2   # saved times per run; the fit starts at T0 (us)
if QUICK:
    ALPHAS = [1.0, 1.5, 2.1, 3.0]
CACHE = RESULTS / ('task2_2_quick' if QUICK else 'task2_2')
CACHE.mkdir(exist_ok=True)
ka = float(kappa_a)


def gamma_coth(al):                # cat-manifold rate kappa_a alpha^2 (tanh + coth)(alpha^2) = 2 kappa_a alpha^2 coth(2 alpha^2)
    return 2 * ka * al**2 / np.tanh(2 * al**2)


def t_end(al):                     # three predicted decay times
    return round((0.1 if QUICK else 1.0) * 3 / gamma_coth(al), 1)


def model(al, Na, Nb):
    a, b = dq.destroy(Na, Nb)
    H = g2 * (a @ a @ b.dag()) + g2 * (a.dag() @ a.dag() @ b) - al**2 * g2 * (b + b.dag())
    return a, b, H, [jnp.sqrt(kappa_b) * b, jnp.sqrt(kappa_a) * a]


def even_sector(al, Na, Nb):
    """Sparse Liouvillian restricted to operators even under rho -> P rho P."""
    _, _, H, jumps = model(al, Na, Nb)
    N = Na * Nb
    I = sp.identity(N, format='csr')
    m = lambda x: sp.csr_matrix(x.to_numpy())
    Hs = m(H)
    L = -1j * (sp.kron(I, Hs) - sp.kron(Hs.T, I))       # column-stacked vec: vec(A X B) = (B^T kron A) vec(X)
    for J in map(m, jumps):
        JdJ = J.conj().T @ J
        L = L + sp.kron(J.conj(), J) - 0.5 * sp.kron(I, JdJ) - 0.5 * sp.kron(JdJ.T, I)
    p = np.diag(dq.tensor(dq.parity(Na), dq.eye(Nb)).to_numpy()).real
    keep = np.nonzero(np.kron(p, p) > 0)[0]              # vec index j N + i holds rho_ij, kept when p_i p_j = +1
    return L.tocsr()[keep][:, keep].tocsr()


def slow_modes(Ls, k=8, tau=1.0):
    """The k eigenvalues of largest real part, sorted. Arnoldi on the propagator exp(L tau), whose largest |mu| =
    exp(tau Re lam) are the slowest modes, so complex pairs far from the real axis are not missed (a real
    shift-invert is). lam is the Rayleigh quotient of each eigenvector; also returns the largest residual."""
    op = LinearOperator(Ls.shape, matvec=lambda v: expm_multiply(tau * Ls, v), dtype=complex)
    _, V = eigs(op, k=k, which='LM', ncv=40)
    LV = Ls @ V
    lam = np.einsum('ij,ij->j', V.conj(), LV) / np.einsum('ij,ij->j', V.conj(), V)
    res = (np.linalg.norm(LV - V * lam, axis=0) / np.linalg.norm(V, axis=0)).max()
    return lam[np.argsort(-lam.real)], res


def modes(al, Na, Nb):
    f = CACHE / f'modes_{al:.2f}_{Na}_{Nb}.npz'
    if f.exists():                                       # checkpoint: skip finished points
        return np.load(f)['lam']
    t0 = time.time()
    lam, res = slow_modes(even_sector(al, Na, Nb))
    print(f'alpha={al:.2f} Na={Na} Nb={Nb}: slowest even-sector eigenvalues '
          + ', '.join(f'{x.real:.5f}{x.imag:+.5f}j' for x in lam) + f' (max residual {res:.1e}, '
          f'{time.time() - t0:.0f} s)', flush=True)
    np.savez(f, lam=lam, res=res)
    return lam


def pair(lam):                     # slowest oscillating mode, the memory-buffer exchange, with Im > 0
    return next(x for x in lam if x.imag > 1)


def real_mode(lam):                # slowest real mode after the steady state and the parity mode, for printing
    return next((f'{x.real:.4f}' for x in lam[2:] if abs(x.imag) < 1e-6), 'none')


def run(al, Na, Nb):
    f = CACHE / f'{al:.2f}_{Na}_{Nb}.npz'
    if f.exists():                                       # checkpoint: skip finished points
        return dict(np.load(f))
    a, b, H, jumps = model(al, Na, Nb)
    n, P = a.dag() @ a, dq.tensor(dq.parity(Na), dq.eye(Nb))
    psi0 = dq.tensor(dq.unit(dq.coherent(Na, al) + dq.coherent(Na, -al)), dq.fock(Nb, 0))
    t = jnp.linspace(0.0, t_end(al), NT)
    t0 = time.time()
    r = dq.mesolve(H, jumps, psi0, t, exp_ops=[P, n, n @ P, b.dag() @ b], save_states=False, method=METHOD,
                   progress_meter=False,
                   save_extra=lambda _, rho: (jnp.diagonal(dq.ptrace(rho, 0).to_jax()).real,
                                              jnp.diagonal(dq.ptrace(rho, 1).to_jax()).real))
    e = np.asarray(r.expects).real
    out = dict(t=np.asarray(t), P=e[0], n=e[1], nP=e[2], nb=e[3], pa=np.asarray(r.extra[0]), pb=np.asarray(r.extra[1]))
    print(f'alpha={al:.2f} Na={Na} Nb={Nb}: T={t_end(al)} us, P(T)={out["P"][-1]:.5f}, {time.time() - t0:.0f} s',
          flush=True)
    np.savez(f, **out)
    return out


def fit(d, al, lo=T0, hi=np.inf, pinf=None):
    """Fit P = P_inf + A exp(-Gamma t) on lo <= t <= hi; with pinf given, P_inf is fixed. Returns Gamma, P_inf, n, A."""
    t, P = d['t'], d['P']
    w = (t >= lo) & (t <= hi)
    if pinf is None:
        (c, A, G), _ = curve_fit(lambda t, c, A, G: c + A * np.exp(-G * t), t[w], P[w],
                                 p0=(1 / np.cosh(2 * al**2), 1.0, gamma_coth(al)))
        return G, c, int(w.sum()), A
    (A, G), _ = curve_fit(lambda t, A, G: pinf + A * np.exp(-G * t), t[w], P[w], p0=(1.0, gamma_coth(al)))
    return G, pinf, int(w.sum()), A


if __name__ == '__main__':
    pts = [(al, NA[al], NB) for al in ALPHAS] + [(al, NA[al] + DNA, NB) for al in ALPHAS] \
        + [(al, NA[al], NB + DNB) for al in ALPHAS]
    runs = {p: run(*p) for p in pts}
    lams = {p: modes(*p) for p in pts}

    def stats(d, al):                                    # quantities quoted per run, for the truncation comparison
        G, c, nfit, A = fit(d, al)
        P, n, nP = d['P'][-1], d['n'][-1], d['nP'][-1]
        return dict(G=G, c=c, nfit=nfit, A=A, n_e=(n + nP) / (1 + P), n_o=(n - nP) / (1 - P),   # sector photon numbers
                    n_w=d['n'][d['t'] >= T0].mean())                                          # mean n over fit window

    rows = []
    print('alpha alpha^2 NaxNb T(us) n_fit Gamma_fit P_inf_fit 1/cosh(2a^2) 2ka*a^2 coth-rate ka(n_e+n_o) '
          'Liouvillian 2ka<n>', flush=True)
    for al in ALPHAS:
        Na, d = NA[al], runs[(al, NA[al], NB)]
        r = stats(d, al)
        G, c, nfit, n_e, n_o = r['G'], r['c'], r['nfit'], r['n_e'], r['n_o']
        lam = lams[(al, Na, NB)]
        G_L = -lam[1].real                                   # lam[0] = 0 is the steady state, lam[1] the parity mode
        r.update(al=al, G_lin=2 * ka * al**2, G_coth=gamma_coth(al), G_sec=ka * (n_e + n_o), G_L=G_L,
                 lam_pair=pair(lam), G_n=2 * ka * r['n_w'])
        rows.append(r)
        print(f'{al:.2f} {al**2:.4f} {Na}x{NB} {d["t"][-1]:.1f} {nfit} {G:.5f} {c:.5f} {1 / np.cosh(2 * al**2):.5f} '
              f'{2 * ka * al**2:.5f} {gamma_coth(al):.5f} {ka * (n_e + n_o):.5f} {G_L:.5f} {r["G_n"]:.5f}',
              flush=True)
        print(f'  photon numbers at T: even sector {n_e:.4f}, odd sector {n_o:.4f}, mean over fit window '
              f'{r["n_w"]:.4f} (alpha^2 tanh = {al**2 * np.tanh(al**2):.4f}, alpha^2 coth = '
              f'{al**2 / np.tanh(al**2):.4f}), P_inf from sectors (n_o - n_e)/(n_o + n_e) = '
              f'{(n_o - n_e) / (n_o + n_e):.5f}; coth(2a^2) - 1 = {1 / np.tanh(2 * al**2) - 1:.1e}; ratios '
              f'Gamma_fit/2ka*a^2 = {G / (2 * ka * al**2):.5f}, Gamma_fit/coth-rate = {G / gamma_coth(al):.5f}, '
              f'Gamma_fit/ka(n_e+n_o) = {G / (ka * (n_e + n_o)):.5f}, Gamma_fit/Liouvillian = {G / G_L:.6f}; '
              f'phase-flip time 1/Gamma_fit = {1 / G:.3f} us', flush=True)
        lin = -kappa_b / 4 + 1j * np.sqrt((2 * g2 * al)**2 - kappa_b**2 / 16)
        print(f'  even-sector Liouvillian: parity mode {lam[1].real:.6f} /us, exchange pair {pair(lam).real:.4f} +- '
              f'{pair(lam).imag:.3f}i /us (linearized {lin.real:.3f} +- {lin.imag:.3f}i; decay rate / Gamma_fit = '
              f'{-pair(lam).real / G:.1f}), slowest real mode after the parity mode {real_mode(lam)}', flush=True)
        T = d['t'][-1]
        var = {'[0, T]': fit(d, al, lo=0.0), '[T0, T/2]': fit(d, al, hi=T / 2), '[T/2, T]': fit(d, al, lo=T / 2),
               'P_inf fixed to 1/cosh(2a^2)': fit(d, al, pinf=1 / np.cosh(2 * al**2))}
        print('  window check, relative change of Gamma: '
              + ', '.join(f'{k} (n={v[2]}) {(v[0] - G) / G:+.1e}' for k, v in var.items()), flush=True)
        r['dwin'] = max(abs(v[0] - G) / G for k, v in var.items() if 'fixed' not in k)

        top_a, top_b = d['pa'][:, -2:].sum(1).max(), d['pb'][:, -1].max()
        print(f'  truncation: max top-2 memory population {top_a:.1e}, max top buffer population {top_b:.1e}, '
              f'max <b^dag b> {d["nb"].max():.1e}', flush=True)
        dG, dq_, dL, dnext = [], [], [], []
        for big in ((al, Na + DNA, NB), (al, Na, NB + DNB)):
            rb, lb = stats(runs[big], al), lams[big]
            dG.append(abs(rb['G'] / G - 1))
            dq_.append(max(abs(rb[k] - r[k]) for k in ('c', 'n_e', 'n_o', 'n_w')))
            dL.append(abs(lb[1].real / lam[1].real - 1))
            dnext.append((abs(pair(lb).real - pair(lam).real), abs(pair(lb).imag - pair(lam).imag)))
            print(f'    at Na={big[1]} Nb={big[2]}: relative change of Gamma_fit {dG[-1]:.1e}, of the parity eigenvalue '
                  f'{dL[-1]:.1e}; absolute change of P_inf {rb["c"] - c:+.1e}, n_e {rb["n_e"] - n_e:+.1e}, n_o '
                  f'{rb["n_o"] - n_o:+.1e}, window-mean n {rb["n_w"] - r["n_w"]:+.1e}; exchange pair '
                  f'{pair(lb).real:.4f} +- {pair(lb).imag:.3f}i /us, moves by {dnext[-1][0]:.1e} in decay rate and {dnext[-1][1]:.1e} in frequency (/us); slowest real mode '
                  f'after the parity mode {real_mode(lb)}' + (f' among the {len(lb)} slowest (decay rates up to '
                  f'{-lb[-1].real:.2f} /us)' if real_mode(lb) == 'none' else ''), flush=True)
        r.update(top_a=top_a, top_b=top_b, nb=d['nb'].max(), dG=max(dG), dq=max(dq_), dL=max(dL),
                 dnext_re=max(x[0] for x in dnext), dnext_im=max(x[1] for x in dnext))

    Ls = even_sector(2.1, 16, NB)                        # completeness check of slow_modes against a dense spectrum
    t0 = time.time()
    ev = np.linalg.eigvals(Ls.toarray())
    lam = slow_modes(Ls)[0]
    print(f'dense check, alpha=2.10 Na=16 Nb={NB} (dim {Ls.shape[0]}, {time.time() - t0:.0f} s): each of the {len(lam)} '
          f'slowest modes lies {max(np.abs(ev - x).min() for x in lam):.1e} from a dense eigenvalue, sorted real parts '
          f'differ by at most {np.abs(lam.real - np.sort(ev.real)[::-1][:len(lam)]).max():.1e}', flush=True)

    x, G = np.array(ALPHAS)**2, np.array([r['G'] for r in rows])
    print(f'largest |Gamma_fit/Liouvillian - 1| {max(abs(r["G"] / r["G_L"] - 1) for r in rows):.1e}, largest '
          f'|Gamma_fit/ka(n_e+n_o) - 1| {max(abs(r["G"] / r["G_sec"] - 1) for r in rows):.1e}, smallest '
          f'exchange-pair decay rate / Gamma_fit {min(-r["lam_pair"].real / r["G"] for r in rows):.1f}', flush=True)
    print(f'largest window change with P_inf free {max(r["dwin"] for r in rows):.1e}, largest top-2 memory population '
          f'{max(r["top_a"] for r in rows):.1e}, largest top buffer population {max(r["top_b"] for r in rows):.1e}, '
          f'largest <b^dag b> {max(r["nb"] for r in rows):.1e}', flush=True)
    print(f'larger truncations (Na+{DNA} or Nb={NB + DNB}), largest changes over all alphas: Gamma_fit '
          f'{max(r["dG"] for r in rows):.1e} relative, parity eigenvalue {max(r["dL"] for r in rows):.1e} relative, '
          f'P_inf and photon numbers {max(r["dq"] for r in rows):.1e} absolute, exchange pair {max(r["dnext_re"] for r in rows):.1e}'
          f' in decay rate and {max(r["dnext_im"] for r in rows):.1e} in frequency (/us)', flush=True)
    fits = {}
    for name, sel in (('all', x > 0), ('alpha >= 1.5', x >= 1.5**2)):
        (s, i), cov = np.polyfit(x[sel], G[sel], 1, cov=True)
        fits[name] = (s, i)
        print(f'linear fit Gamma_Z = s alpha^2 + i over {name} (n={sel.sum()}): s = {s:.5f} +- {np.sqrt(cov[0, 0]):.1e}'
              f' /us, i = {i:.5f} +- {np.sqrt(cov[1, 1]):.1e} /us; 2 kappa_a = {2 * ka:.5f} /us, '
              f's/(2 kappa_a) = {s / (2 * ka):.5f}, -i/(2 kappa_a) = {-i / (2 * ka):.4f} photons', flush=True)

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    cmap = plt.cm.viridis(np.linspace(0, 0.9, len(ALPHAS)))
    for k, (al, r) in enumerate(zip(ALPHAS, rows)):
        d = runs[(al, NA[al], NB)]
        ax.plot(d['t'], d['P'], color=cmap[k], lw=2, label=rf'$\alpha = {al:g}$')
        ax.plot(d['t'], r['c'] + r['A'] * np.exp(-r['G'] * d['t']), color='k', ls='--', lw=1)
    ax.plot([], [], color='k', ls='--', lw=1, label='Fit')
    style(ax, r'$t$ ($\mu$s)', r'$\langle P\rangle$', '2.2 Parity decay of the even cat')
    ax.legend(fontsize=11, frameon=True, edgecolor='black', ncol=2)
    plt.tight_layout()
    save(fig, 'task2_2_parity.png')

    xs = np.linspace(0.8, 9.5, 300)
    coth = 2 * ka * xs / np.tanh(2 * xs)
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.5), dpi=300)
    ax = axes[0]
    ax.plot(xs, 2 * ka * xs, color=COLORS[1], lw=2, label=r'$2\kappa_a\alpha^2$')
    ax.plot(xs, coth, color=COLORS[2], lw=2, ls='--', label=r'$2\kappa_a\alpha^2\coth 2\alpha^2$')
    ax.plot(x, G, 'o', color=COLORS[0], ms=7, mec='black', label='Fit to $\\langle P\\rangle(t)$')
    style(ax, r'$\alpha^2$', r'$\Gamma_Z$ ($\mu$s$^{-1}$)', r'2.2 $\Gamma_Z$ against $\alpha^2$')
    ax = axes[1]
    ax.axhline(1, color=COLORS[1], lw=2, label=r'$2\kappa_a\alpha^2$')
    ax.plot(xs, coth / (2 * ka * xs), color=COLORS[2], lw=2, ls='--', label=r'$\coth 2\alpha^2$')
    ax.plot(x, [r['G_sec'] / (2 * ka * al**2) for al, r in zip(ALPHAS, rows)], 's', color=COLORS[3], ms=8,
            mfc='none', mew=1.5, label=r'$\kappa_a(n_e + n_o)$, measured')
    ax.plot(x, G / (2 * ka * x), 'o', color=COLORS[0], ms=6, mec='black', label='Fit')
    style(ax, r'$\alpha^2$', r'$\Gamma_Z / 2\kappa_a\alpha^2$', 'Relative to the linear law')
    plt.tight_layout()
    save(fig, 'task2_2_gamma.png')

    out = RESULTS / ('task2_2_quick.npz' if QUICK else 'task2_2.npz')
    np.savez(out, alphas=np.array(ALPHAS),
             **{k: np.array([r[k] for r in rows]) for k in rows[0]},
             slope_intercept_all=np.array(fits['all']), slope_intercept_ge15=np.array(fits['alpha >= 1.5']))
    print(f'wrote {out}', flush=True)
