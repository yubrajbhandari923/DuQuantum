"""Task 2.1 bit-flip rate Gamma_X: decay of Re<a> from |alpha>|0>, cross-checked by the slowest Liouvillian eigenvalue.

Run from the repository root:
  python scripts/task2_1_bit_flip.py eig <alpha>            eigenvalue convergence grid in N_a, N_b (slurm/task2_1_eig.sh)
  python scripts/task2_1_bit_flip.py extra <alpha> [check]  eigenvalues at the chosen (or check) truncation: nominal,
                                                            2 kappa_a, thermal (slurm/task2_1_extra.sh)
  python scripts/task2_1_bit_flip.py time <alpha> [check]   time-domain run, check = larger truncation (slurm/task2_1_time.sh)
  python scripts/task2_1_bit_flip.py analyze                fits, tables, effective model, plots (under a minute)
Build functions (build, liouvillian, slow_eigs, gamma_x_eig, fit_decay, run_time) are importable for Task 2.4.
"""
import sys
import time

import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import eigs
import dynamiqs as dq
import jax.numpy as jnp

from common import METHOD, COLORS, RESULTS, g2, kappa2, kappa_a, kappa_b, save, style

CACHE = RESULTS / 'task2_1'
ALPHAS = [0.8, 1.0, 1.2, 1.4]                               # time domain and eigenvalue
ALPHAS_EIG = [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.1]  # eigenvalue only outside ALPHAS
NA_GRID, NB_GRID, NB_MAX = [10, 12, 14, 16, 18, 20, 24], [3, 4, 5, 6, 8], 10
TOL = 1e-3                    # relative change of Gamma_X below which a truncation counts as converged
TRUNC = {0.6: (10, 3), 0.8: (10, 3), 1.0: (12, 3), 1.2: (14, 4), 1.4: (16, 5),   # cheapest (N_a, N_b) converged
         1.6: (20, 6), 1.8: (24, 10), 2.0: (28, 12), 2.1: (28, 12)}       # to TOL in the eig grid
T_END = {0.8: 500.0, 1.0: 1000.0, 1.2: 3500.0, 1.4: 17000.0}      # simulated time per alpha (us), >= 2 T_X
T_FINE, N_CHUNKS = 50.0, 10   # finely saved transient window (us), number of checkpointed chunks after it
N_TH = [0.01, 0.1]            # illustrative thermal occupations of the memory bath
LONG = dq.method.Tsit5(rtol=METHOD.rtol, atol=METHOD.atol, max_steps=10**8)  # METHOD tolerances, long chunks need >1e5 steps


def build(alpha, Na, Nb, n_th=0.0, eps_Z=0.0, ka=kappa_a):
    """Two-mode H_2ph (+ eps_Z (a + a^dag)) with eps_d = alpha^2 g2, and jump operators (thermal memory bath if n_th > 0)."""
    a, b = dq.destroy(Na, Nb)
    H = g2 * (a @ a @ b.dag() + a.dag() @ a.dag() @ b) - alpha**2 * g2 * (b + b.dag()) + eps_Z * (a + a.dag())
    jumps = [jnp.sqrt(kappa_b) * b, jnp.sqrt(ka * (1 + n_th)) * a]
    if n_th:
        jumps.append(jnp.sqrt(ka * n_th) * a.dag())
    return H, jumps


def liouvillian(alpha, Na, Nb, n_th=0.0, eps_Z=0.0, ka=kappa_a):
    """Sparse Lindbladian on column-stacked vec(rho) (same convention as dq.slindbladian): vec(A rho B) = (B^T kron A) vec(rho)."""
    H, jumps = build(alpha, Na, Nb, n_th, eps_Z, ka)
    H = sp.csr_matrix(np.asarray(H.to_numpy()))
    I = sp.identity(H.shape[0], format='csr')
    L = -1j * sp.kron(I, H) + 1j * sp.kron(H.T, I)
    for J in jumps:
        J = sp.csr_matrix(np.asarray(J.to_numpy()))
        JdJ = J.conj().T @ J
        L = L + sp.kron(J.conj(), J) - 0.5 * sp.kron(I, JdJ) - 0.5 * sp.kron(JdJ.T, I)
    return L.tocsc()


def odd_sector(Na, Nb):
    """Indices of vec(rho) entries rho_{(na,nb),(ma,mb)} with na - ma odd (odd under rho -> P rho P, P the memory parity)."""
    D = Na * Nb
    v = np.arange(D * D)
    return np.nonzero(((v % D) // Nb - (v // D) // Nb) % 2)[0]


def slow_eigs(alpha, Na, Nb, n_th=0.0, eps_Z=0.0, ka=kappa_a, k=3):
    """The k Liouvillian eigenvalues closest to 0 by shift-invert, sorted by |lambda|, with their odd-sector weight.

    eps_Z = 0: only the odd sector, which has no zero eigenvalue (sigma = 0); weights are 1.
    eps_Z != 0 breaks the a -> -a symmetry: full space with sigma = 0, the first eigenvalue is the steady state (~0)
    and the bit-flip mode is the slow one whose eigenvector has the largest odd-sector weight."""
    L = liouvillian(alpha, Na, Nb, n_th, eps_Z, ka)
    odd = odd_sector(Na, Nb)
    if eps_Z == 0:
        lam = eigs(L[odd][:, odd], k=k, sigma=0, which='LM', return_eigenvectors=False)
        return lam[np.argsort(np.abs(lam))], np.ones(k)
    lam, v = eigs(L, k=k, sigma=0, which='LM')
    order = np.argsort(np.abs(lam))
    lam, v = lam[order], v[:, order]
    return lam, np.linalg.norm(v[odd], axis=0) / np.linalg.norm(v, axis=0)


def gamma_x_eig(alpha, Na, Nb, n_th=0.0, eps_Z=0.0, ka=kappa_a, k=3):
    """Gamma_X = -Re(lambda) of the slowest odd (bit-flip) Liouvillian mode."""
    lam, w = slow_eigs(alpha, Na, Nb, n_th, eps_Z, ka, k)
    if eps_Z == 0:
        return -lam[0].real
    lam, w = lam[1:], w[1:]                             # drop the steady state
    return -lam[np.argmax(w)].real


def fit_decay(t, y, t0, t1):
    """Fit y = A exp(-Gamma t) on t0 <= t <= t1 (log-linear least squares); returns Gamma, A, stderr(Gamma), n points."""
    m = (t >= t0) & (t <= t1)
    (slope, c), cov = np.polyfit(t[m], np.log(y[m]), 1, cov=True)
    return -slope, np.exp(c), np.sqrt(cov[0, 0]), int(m.sum())


def run_time(alpha, Na, Nb, tsave, rho0=None, eps_Z=0.0):
    """mesolve from rho0 (default |alpha>|0>); returns Re<a>, memory and buffer Fock populations, final state."""
    H, jumps = build(alpha, Na, Nb, eps_Z=eps_Z)
    a, _ = dq.destroy(Na, Nb)
    if rho0 is None:
        rho0 = dq.tensor(dq.coherent(Na, alpha), dq.fock(Nb, 0))
    r = dq.mesolve(H, jumps, rho0, tsave, exp_ops=[a], method=LONG, save_states=False, progress_meter=False,
                   save_extra=lambda _, rho: (jnp.diagonal(dq.ptrace(rho, 0).to_jax()).real,
                                              jnp.diagonal(dq.ptrace(rho, 1).to_jax()).real))
    pa, pb = r.extra
    return np.asarray(r.expects[0].real), np.asarray(pa), np.asarray(pb), r.final_state


def effective_gamma_x(alpha, N, ka=kappa_a):
    """Gamma_X of the memory-only model (jumps sqrt(kappa2)(a^2 - alpha^2), sqrt(ka) a), slowest odd eigenvalue."""
    a = sp.diags(np.sqrt(np.arange(1, N)), 1, format='csr').astype(complex)
    I = sp.identity(N, format='csr')
    L = sp.csr_matrix((N * N, N * N), dtype=complex)
    for J in (np.sqrt(kappa2) * (a @ a - alpha**2 * I), np.sqrt(ka) * a):
        JdJ = J.conj().T @ J
        L = L + sp.kron(J.conj(), J) - 0.5 * sp.kron(I, JdJ) - 0.5 * sp.kron(JdJ.T, I)
    v = np.arange(N * N)
    odd = np.nonzero(((v % N) - (v // N)) % 2)[0]
    lam = eigs(L.tocsc()[odd][:, odd], k=2, sigma=0, which='LM', return_eigenvectors=False)
    return -lam[np.argmin(np.abs(lam))].real


def first_order_rate(alpha, ka=kappa_a):
    """Code-space (golden-rule) estimate: jumps a and no-jump decay -ka a^dag a/2 acting on the cat basis |C+->,
    Gamma_X = ka alpha^2 (coth 2 alpha^2 - 1) ~ 2 ka alpha^2 exp(-4 alpha^2)."""
    return ka * alpha**2 * (1 / np.tanh(2 * alpha**2) - 1)


# ---------------------------------------------------------------- cached runs
def cached_eigs(tag, alpha, Na, Nb, **kw):
    f = CACHE / f'{tag}_{alpha:.2f}_{Na}_{Nb}.npz'
    if f.exists():
        return np.load(f)['lam']
    t0 = time.time()
    lam, _ = slow_eigs(alpha, Na, Nb, **kw)
    np.savez(f, lam=lam, seconds=time.time() - t0)
    print(f'{tag} alpha={alpha:.2f} Na={Na:2d} Nb={Nb:2d}: Gamma_X = {-lam[0].real:.8e}, next {-lam[1].real:.6f} /us, '
          f'{time.time() - t0:.0f} s', flush=True)
    return lam


def grid(alpha):
    """Convergence grid: N_a sweep at N_b = NB_MAX and N_b sweep at the largest N_a, each against its last point.
    From alpha = 1.8 the buffer sweep goes to N_b = 12 (Gamma_X still moved by 0.4-0.8% from N_b = 8 to 10); the check
    truncation (N_a, N_b + 2) then tests N_b = 14."""
    na_max = 28 if alpha <= 1.6 else 32
    na_sweep = [(Na, NB_MAX) for Na in sorted(set(NA_GRID + [28, na_max]))]
    nb_sweep = [(na_max, Nb) for Nb in NB_GRID + [NB_MAX] + ([12] if alpha >= 1.8 else [])]
    return na_sweep, nb_sweep


def check_trunc(alpha):
    """Larger truncation for the check: (N_a + 4, N_b + 2); from alpha = 1.8 on, where N_a is converged and each extra
    buffer level is costly, (N_a, N_b + 2)."""
    Na, Nb = TRUNC[alpha]
    return (Na + 4, Nb + 2) if alpha <= 1.6 else (Na, Nb + 2)


def tags(alpha):
    """Eigenvalue variants per alpha: nominal and 2 kappa_a everywhere, thermal up to alpha = 1.4."""
    return ['eig', 'ka2'] + ([f'th{n:g}' for n in N_TH] if alpha <= 1.4 else [])


def variant_kw(tag):
    if tag.startswith('th'):
        return dict(n_th=float(tag[2:]))
    if tag.startswith('ka'):
        return dict(ka=kappa_a * float(tag[2:]))
    return {}


def time_file(alpha, Na, Nb, T):
    return CACHE / f'time_{alpha:.2f}_{Na}_{Nb}_{T:g}.npz'


def time_run(alpha, check=False):
    """Chunked mesolve, checkpointed after each chunk; the check run uses the larger truncation over T/2."""
    Na, Nb = check_trunc(alpha) if check else TRUNC[alpha]
    T = T_END[alpha] / 2 if check else T_END[alpha]
    f = time_file(alpha, Na, Nb, T)
    part = f.with_suffix('.part.npz')
    edges = np.linspace(T_FINE, T, N_CHUNKS + 1)
    chunks = [np.linspace(0.0, T_FINE, 251)] + [np.linspace(edges[k], edges[k + 1], 101) for k in range(N_CHUNKS)]
    if f.exists():
        print(f'{f.name} exists, skipping', flush=True)
        return
    done, out, rho = 0, {'t': [], 'x': [], 'pa': [], 'pb': []}, None
    if part.exists():
        d = np.load(part)
        done, rho = int(d['done']), dq.asqarray(d['rho'], dims=(Na, Nb))
        out = {k: [d[k]] for k in out}
    print(f'alpha={alpha} Na={Na} Nb={Nb} T={T:g} us, {N_CHUNKS + 1} chunks, starting at chunk {done}', flush=True)
    t_start = time.time()
    for k in range(done, len(chunks)):
        x, pa, pb, rho = run_time(alpha, Na, Nb, jnp.asarray(chunks[k]), rho0=rho)
        s = slice(0 if k == 0 else 1, None)                 # drop the repeated chunk boundary
        for key, v in zip(out, (chunks[k], x, pa, pb)):
            out[key].append(v[s])
        cat = {key: np.concatenate(v) for key, v in out.items()}
        np.savez(part, done=k + 1, rho=np.asarray(rho.to_jax()), **cat)
        print(f'  chunk {k + 1}/{len(chunks)} to t = {chunks[k][-1]:.1f} us: Re<a> = {x[-1]:.10f}, '
              f'top memory {pa[:, -2:].sum(1).max():.1e}, top buffer {pb[:, -1].max():.1e}, '
              f'{time.time() - t_start:.0f} s', flush=True)
    np.savez(f, Na=Na, Nb=Nb, seconds=time.time() - t_start, **cat)
    part.unlink()
    print(f'wrote {f}', flush=True)


def eig_cached(tag, alpha, Na, Nb):
    return np.load(CACHE / f'{tag}_{alpha:.2f}_{Na}_{Nb}.npz')['lam']


def loglin(alphas, rates):
    """ln Gamma = c - gamma alpha^2: returns gamma, its standard error, n."""
    (s, c), cov = np.polyfit(np.asarray(alphas)**2, np.log(rates), 1, cov=True)
    return -s, np.sqrt(cov[0, 0]), len(alphas)


def local_exponent(alphas, rates):
    a2 = np.asarray(alphas)**2
    return (a2[1:] + a2[:-1]) / 2, -np.diff(np.log(rates)) / np.diff(a2)


def analyze():
    import matplotlib.pyplot as plt
    print(f'kappa_a = {kappa_a:.5f} /us, kappa2 = {kappa2:.4f} /us, kappa_a/kappa2 = {kappa_a / kappa2:.5f}, '
          f'g2/kappa_b = {g2 / kappa_b:.3f}', flush=True)
    H, J = build(1.0, 6, 3, n_th=0.05, eps_Z=0.1)
    diff = np.abs(liouvillian(1.0, 6, 3, n_th=0.05, eps_Z=0.1).toarray() - np.asarray(dq.slindbladian(H, J).to_numpy()))
    print(f'sparse Lindbladian against dq.slindbladian at N_a = 6, N_b = 3: max difference {diff.max():.1e}', flush=True)

    # 1. truncation convergence of the eigenvalue, Task 1.2 rule against the largest grid point
    print(f'\neigenvalue convergence (tolerance {TOL:g} on Gamma_X):', flush=True)
    for alpha in ALPHAS_EIG:
        na_sweep, nb_sweep = grid(alpha)
        na_max, nb_max = nb_sweep[-1]
        ref = -eig_cached('eig', alpha, na_max, nb_max)[0].real
        conv = {}
        for name, sweep in (('Na', na_sweep), ('Nb', nb_sweep)):
            i = 0 if name == 'Na' else 1
            g = np.array([-eig_cached('eig', alpha, *p)[0].real for p in sweep])
            rel = np.abs(g / g[-1] - 1)
            conv[name] = next(p[i] for j, p in enumerate(sweep) if np.all(rel[j:] < TOL))
            print(f'  alpha={alpha:.1f} {name} sweep: ' + ', '.join(f'{p[i]}: {r:.1e}' for p, r in zip(sweep, rel))
                  + f' -> converged from {name} = {conv[name]}', flush=True)
        Na, Nb = TRUNC[alpha]
        g_tr, g_ch = (-eig_cached('eig', alpha, *p)[0].real for p in (TRUNC[alpha], check_trunc(alpha)))
        print(f'  alpha={alpha:.1f} reference ({na_max}, {nb_max}) Gamma_X = {ref:.6e} /us; chosen ({Na}, {Nb}) '
              f'{g_tr:.6e} ({g_tr / ref - 1:+.1e}), check {check_trunc(alpha)} {g_ch:.6e} ({g_ch / ref - 1:+.1e})',
              flush=True)
        assert Na >= conv['Na'] and Nb >= conv['Nb'] and abs(g_tr / ref - 1) < TOL
        print(f'  alpha={alpha:.1f} eps_d/kappa_b = {alpha**2 * g2 / kappa_b:.3f}, buffer photons when the memory sits at '
              f'a = 0 (mean field b = 2i eps_d/kappa_b): {(2 * alpha**2 * g2 / kappa_b)**2:.2f}', flush=True)

    # 2. time-domain fits against the eigenvalue at the same truncation
    print('\ntime domain, fit Re<a> = A exp(-Gamma_X t) on [t0, T], t0 = 10/|lambda_2|:', flush=True)
    td = {}
    for alpha in ALPHAS:
        Na, Nb = TRUNC[alpha]
        T = T_END[alpha]
        d = np.load(time_file(alpha, Na, Nb, T))
        t, x = d['t'], d['x']
        lam = eig_cached('eig', alpha, Na, Nb)
        g_eig, lam2 = -lam[0].real, -lam[1].real
        t0 = 10 / lam2
        G, A, se, n = fit_decay(t, x, t0, T)
        var = [fit_decay(t, x, a, b)[0] for a, b in ((t0 / 2, T), (2 * t0, T), (t0, T / 2), (2 * t0, T / 2))]
        spread = max(abs(v / G - 1) for v in var)
        top_a, top_b = d['pa'][:, -2:].sum(1).max(), d['pb'][:, -1].max()
        dev = np.abs(-np.gradient(np.log(x), t) / g_eig - 1)
        settle = t[np.nonzero(dev > 1e-6)[0][-1] + 1]          # local rate within 1e-6 of -lambda_1 from here on
        c = np.load(time_file(alpha, *check_trunc(alpha), T / 2))
        G_c = fit_decay(c['t'], c['x'], t0, T / 2)[0]
        G_b = fit_decay(t, x, t0, T / 2)[0]
        td[alpha] = dict(t=t, x=x, G=G, A=A, t0=t0, T=T, g_eig=g_eig, pa=d['pa'], pb=d['pb'])
        print(f'  alpha={alpha:.1f} ({Na}, {Nb}), T = {T:g} us = {T * G:.2f} T_X, {t.size} saved times, '
              f'{float(d["seconds"]):.0f} s: Gamma_X = {G:.6e} /us (T_X = {1 / G:.1f} us), A = {A:.5f}, '
              f'window [{t0:.1f}, {T:g}] us, n = {n}, stderr {se / G:.1e}; eigenvalue {g_eig:.6e} '
              f'(fit/eig - 1 = {G / g_eig - 1:+.1e}); lambda_2 = {lam2:.4f} /us vs kappa_a alpha^2 (coth 2 alpha^2 + 1) = '
              f'{kappa_a * alpha**2 * (1 / np.tanh(2 * alpha**2) + 1):.4f}; window moves change Gamma_X by at most {spread:.1e}', flush=True)
        print(f'      Re<a>: {x[0]:.6f} at 0, {np.interp(t0, t, x):.6f} at t0, {x[-1]:.6f} at T; '
              f'max top-2 memory population {top_a:.1e}, top buffer {top_b:.1e}; check run {check_trunc(alpha)} '
              f'on [{t0:.1f}, {T / 2:g}]: Gamma_X {G_c:.6e} vs {G_b:.6e} ({G_c / G_b - 1:+.1e}), '
              f'top memory {c["pa"][:, -2:].sum(1).max():.1e}, top buffer {c["pb"][:, -1].max():.1e}; local rate within 1e-6 '
              f'of -lambda_1 from t = {settle:.1f} us', flush=True)

    # 3. log-linear fits and comparisons
    G_td = np.array([td[a]['G'] for a in ALPHAS])
    ge = {}
    for tag in ['eig', 'ka2'] + [f'th{n:g}' for n in N_TH]:
        ge[tag], chk = (np.array([-eig_cached(tag, a, *tr(a))[0].real
                                  if tag in tags(a) and (CACHE / f'{tag}_{a:.2f}_{tr(a)[0]}_{tr(a)[1]}.npz').exists()
                                  else np.nan for a in ALPHAS_EIG]) for tr in (TRUNC.get, check_trunc))
        miss = [a for a, v, c in zip(ALPHAS_EIG, ge[tag], chk) if np.isfinite(v) and not np.isfinite(c)]
        print(f'  {tag}: largest relative change from the chosen to the check truncation '
              f'{np.nanmax(np.abs(chk / ge[tag] - 1)):.1e}'
              + (f' (no check run at alpha = {", ".join(f"{a:g}" for a in miss)})' if miss else ''), flush=True)
    # Gamma_X(k) = A k + B k^2 + O(k^3): part linear in kappa_a and the remainder from Gamma_X(kappa_a), Gamma_X(2 kappa_a)
    lin = 2 * ge['eig'] - ge['ka2'] / 2
    rem = ge['eig'] - lin
    sel = np.isin(ALPHAS_EIG, ALPHAS)
    g1 = first_order_rate(np.array(ALPHAS_EIG))
    eff = np.array([effective_gamma_x(a, 40) for a in ALPHAS_EIG])
    eff50 = np.array([effective_gamma_x(a, 50) for a in ALPHAS_EIG])
    print(f'\neffective model N = 40 vs 50: max relative change {np.max(np.abs(eff / eff50 - 1)):.1e}', flush=True)
    print('\nlog-linear fits ln Gamma_X = c - gamma alpha^2 over alpha = ' + ', '.join(f'{a:g}' for a in ALPHAS) + ':',
          flush=True)
    rows = [('time domain', G_td), ('eigenvalue', ge['eig'][sel])]
    rows += [(f'eigenvalue n_th = {n:g}', ge[f'th{n:g}'][sel]) for n in N_TH]
    rows += [('part linear in kappa_a', lin[sel]), ('remainder', rem[sel]),
             ('first-order formula', g1[sel]), ('memory-only model', eff[sel])]
    for name, r in rows:
        gam, se, n = loglin(ALPHAS, r)
        print(f'  {name}: gamma = {gam:.3f} +- {se:.3f} (n = {n})', flush=True)
    print('\nper alpha: Gamma_X (eigenvalue, /us), T_X, Gamma_X / first-order formula, Gamma_X(2 kappa_a) / Gamma_X '
          '(2 if linear in kappa_a, 4 if quadratic), part linear in kappa_a / formula, remainder / Gamma_X, '
          'memory-only / two-mode, '
          'n_th = ' + ', '.join(f'{n:g}' for n in N_TH) + ':', flush=True)
    for i, a in enumerate(ALPHAS_EIG):
        print(f'  alpha={a:.1f}: {ge["eig"][i]:.4e}  {1 / ge["eig"][i]:.4g} us  {ge["eig"][i] / g1[i]:.3f}  '
              f'{ge["ka2"][i] / ge["eig"][i]:.3f}  {lin[i] / g1[i]:.4f}  {rem[i] / ge["eig"][i]:.3f}  '
              f'{eff[i] / ge["eig"][i]:.3f}  '
              + '  '.join(f'{ge[f"th{n:g}"][i]:.4e}' for n in N_TH), flush=True)
    print('\nlocal exponent -d ln Gamma_X / d alpha^2 between neighbouring alpha (at the alpha^2 midpoint):', flush=True)
    series = [('two-mode', ge['eig']), ('part linear in kappa_a', lin), ('first-order formula', g1),
              ('remainder', rem), ('memory-only', eff), ('two-mode 2 kappa_a', ge['ka2'])]
    series += [(f'n_th = {n:g}', ge[f'th{n:g}']) for n in N_TH]
    for name, r in series:
        print(f'  {name}: ' + ', '.join(f'{m:.2f}: {v:.2f}' for m, v in zip(*local_exponent(ALPHAS_EIG, r))
                                        if np.isfinite(v)), flush=True)

    # 4. plots
    gam, se, n = loglin(ALPHAS, G_td)
    c0 = np.polyfit(np.array(ALPHAS)**2, np.log(G_td), 1)[1]

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for k, a in enumerate(ALPHAS):
        d = td[a]
        ax.semilogy(d['t'] * d['G'], d['x'], color=COLORS[k], lw=2,
                    label=rf'$\alpha = {a:g}$, $T_X = {1 / d["G"]:.0f}$ $\mu$s')
        s = np.linspace(d['t0'], d['T'], 50)
        ax.semilogy(s * d['G'], d['A'] * np.exp(-d['G'] * s), color='k', ls='--', lw=1.4)
    ax.plot([], [], color='k', ls='--', lw=1.4, label=r'Fit $A e^{-\Gamma_X t}$')
    style(ax, r'$t / T_X$', r'Re$\langle a\rangle$', r'2.1 Decay of Re$\langle a\rangle$ from $|\alpha\rangle|0\rangle$')
    plt.tight_layout()
    save(fig, 'task2_1_re_a.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for k, a in enumerate(ALPHAS):
        d = td[a]
        r = -np.gradient(np.log(d['x']), d['t'])
        ax.loglog(d['t'][1:], np.abs(r[1:] / d['g_eig'] - 1), color=COLORS[k], lw=2, label=rf'$\alpha = {a:g}$')
        ax.axvline(d['t0'], color=COLORS[k], ls=':', lw=1.4)
    ax.set_ylim(1e-14, 1e2)
    style(ax, r'$t$ ($\mu$s)', r'$|\Gamma_{\rm loc}(t)/\Gamma_X^{\rm eig} - 1|$', '2.1 Local decay rate, window starts dotted')
    plt.tight_layout()
    save(fig, 'task2_1_local_rate.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for k, a in enumerate(ALPHAS):
        d = td[a]
        ax.semilogy(d['t'] * d['G'], np.clip(d['pa'][:, -2:].sum(1), 1e-16, None), color=COLORS[k], lw=2,
                    label=rf'$\alpha = {a:g}$, $N_a = {TRUNC[a][0]}$, $N_b = {TRUNC[a][1]}$')
        ax.semilogy(d['t'] * d['G'], np.clip(d['pb'][:, -1], 1e-16, None), color=COLORS[k], lw=2, ls='--')
    ax.plot([], [], color='k', lw=2, label='Memory top two levels')
    ax.plot([], [], color='k', lw=2, ls='--', label='Buffer top level')
    style(ax, r'$t / T_X$', 'Population', '2.1 Truncation check')
    plt.tight_layout()
    save(fig, 'task2_1_truncation.png')

    a2 = np.array(ALPHAS_EIG)**2
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    ax.semilogy(a2, ge['eig'], color=COLORS[1], marker='x', ms=7, lw=1.5, label='Eigenvalue, two-mode')
    ax.semilogy(np.array(ALPHAS)**2, G_td, 'o', color=COLORS[0], ms=8, mec='black', label=r'Fit of Re$\langle a\rangle(t)$')
    ax.semilogy(a2, np.exp(c0 - gam * a2), color='k', ls='--', lw=1.4, label=rf'$e^{{c - \gamma\alpha^2}}$, $\gamma = {gam:.2f}$')
    ax.semilogy(a2, g1, color=COLORS[2], ls=':', lw=2, label=r'$\kappa_a\alpha^2(\coth 2\alpha^2 - 1)$')
    for k, nt in enumerate(N_TH):
        ax.semilogy(a2, ge[f'th{nt:g}'], color=COLORS[3 + k], marker='s', ms=4, lw=1.2, label=rf'$n_{{\rm th}} = {nt:g}$')
    style(ax, r'$\alpha^2$', r'$\Gamma_X$ ($\mu$s$^{-1}$)', r'2.1 Bit-flip rate')
    ax.legend(fontsize=12, frameon=True, edgecolor='black', loc='upper right')
    plt.tight_layout()
    save(fig, 'task2_1_gamma_x.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    # beyond alpha = 1.6 the remainder is >80% of Gamma_X and the two-point split no longer isolates the linear part
    for k, (name, r) in enumerate([('Two-mode', ge['eig']),
                                   (r'Part linear in $\kappa_a$', np.where(np.array(ALPHAS_EIG) <= 1.6, lin, np.nan)),
                                   (r'$\kappa_a\alpha^2(\coth 2\alpha^2 - 1)$', g1),
                                   ('Two-mode remainder', np.where(rem / ge['eig'] > 0.05, rem, np.nan)),  # >5% of Gamma_X
                                   (rf'Two-mode, $n_{{\rm th}} = {N_TH[-1]:g}$', ge[f'th{N_TH[-1]:g}'])]):
        ax.plot(*local_exponent(ALPHAS_EIG, r), color=COLORS[k], marker='o', ms=5, mec='black', lw=1.5, label=name)
    for y in (2, 4):
        ax.axhline(y, color='k', ls='--', lw=1.4)
    ax.set_ylim(0, 6.5)
    style(ax, r'$\alpha^2$ (midpoint)', r'$-\Delta\ln\Gamma_X/\Delta\alpha^2$', '2.1 Local exponent')
    ax.legend(fontsize=12, frameon=True, edgecolor='black', loc='upper right')
    plt.tight_layout()
    save(fig, 'task2_1_local_exponent.png')

    np.savez(RESULTS / 'task2_1.npz', alphas=ALPHAS, G_td=G_td, alphas_eig=ALPHAS_EIG, first_order=g1, eff=eff,
             **{f'G_{k}': v for k, v in ge.items()},
             **{f't_{a:g}': td[a]['t'] for a in ALPHAS}, **{f'x_{a:g}': td[a]['x'] for a in ALPHAS})
    print(f'wrote {RESULTS / "task2_1.npz"}', flush=True)


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    mode = sys.argv[1]
    if mode == 'eig':
        alpha = float(sys.argv[2])
        for Na, Nb in sorted(set(sum(grid(alpha), [])), key=lambda p: p[0] * p[1]):
            cached_eigs('eig', alpha, Na, Nb)
    elif mode == 'extra':
        alpha = float(sys.argv[2])
        Na, Nb = check_trunc(alpha) if len(sys.argv) > 3 and sys.argv[3] == 'check' else TRUNC[alpha]
        for tag in tags(alpha):
            cached_eigs(tag, alpha, Na, Nb, **variant_kw(tag))
    elif mode == 'time':
        time_run(float(sys.argv[2]), check=len(sys.argv) > 3 and sys.argv[3] == 'check')
    elif mode == 'analyze':
        analyze()
