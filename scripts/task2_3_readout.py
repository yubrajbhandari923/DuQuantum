"""Task 2.3 transmon-free readout: a memory drive eps_Z (a + a^dag) on top of H_2ph imprints the well (+alpha or -alpha)
on the buffer field <b>, which settles to opposite-sign values for the two codewords.

python scripts/task2_3_readout.py I   solves point POINTS[I] (one Slurm array task) and caches it in results/task2_3/
python scripts/task2_3_readout.py     solves any missing point, then analyses and plots
"""
import sys
import time

import dynamiqs as dq
import jax.numpy as jnp
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import curve_fit
from scipy.special import erfcinv

from common import METHOD, COLORS, RESULTS, alpha, g2, kappa2, kappa_a, kappa_b, save, style
import matplotlib.pyplot as plt

G2, KB, KA, K2 = float(g2), float(kappa_b), float(kappa_a), float(kappa2)
T = np.linspace(0.0, 4.0, 801)                  # us
EPS = [0.05, 0.1, 0.2]                          # eps_Z / g2
MAIN_EPS, MAIN_SIZE, REF_SIZE = 0.1, (32, 12), (40, 16)
SIZES = [(16, 4), (24, 8), MAIN_SIZE]
POINTS = [(Na, Nb, e) for Na, Nb in SIZES + [REF_SIZE] for e in EPS]   # 40 x 16 at 0.1 is index 10
TOL = 0.01                                      # settling: Re<b> stays within 1% of its quasi-steady value
T_FIT = (0.5, 2.0)                              # damped-cosine fit window (us), after the fastest modes have died
T_DRIFT = 3.0                                   # linear fit over T_DRIFT <= t <= 4 us: quasi-steady value and slow drift
GAMMA_X0 = 3.85337054e-07                       # Task 2.1 Gamma_X at alpha = 2.1, eps_Z = 0 (32 x 10, logs/duq-task2_1-eig-16159820_8.out)
P_ERR = 0.01                                    # target assignment error for the integration-time estimate
CACHE = RESULTS / 'task2_3'
NOISE_SIZE, NOISE_REF = (24, 8), (28, 10)          # truncations of the homodyne-noise check
GAMMA = KB / 4                                  # linearized damping rate (Task 1.1)
OMEGA = np.sqrt((2 * G2 * alpha)**2 - GAMMA**2)  # linearized ringing frequency


def model(Na, Nb, eps_Z, alpha=alpha):
    """H_2ph + eps_Z (a + a^dag) with eps_d = alpha^2 g2, the jump operators, and the mode operators a, b."""
    a, b = dq.destroy(Na, Nb)
    H = g2 * (a @ a @ b.dag() + a.dag() @ a.dag() @ b) - alpha**2 * g2 * (b + b.dag()) + eps_Z * (a + a.dag())
    return H, [jnp.sqrt(kappa_b) * b, jnp.sqrt(kappa_a) * a], a, b


def solve_b(Na, Nb, eps_Z, t=T, alpha=alpha):
    """Solve from |+alpha>|0> and |-alpha>|0> (batch index 0 and 1): <b>, <a>, photon numbers, top-level populations."""
    H, jumps, a, b = model(Na, Nb, eps_Z, alpha)
    top_a = dq.tensor(dq.fock_dm(Na, Na - 2) + dq.fock_dm(Na, Na - 1), dq.eye(Nb))   # top two memory levels
    top_b = dq.tensor(dq.eye(Na), dq.fock_dm(Nb, Nb - 1))                            # top buffer level
    psi0 = dq.stack([dq.tensor(dq.coherent(Na, s * alpha), dq.fock(Nb, 0)) for s in (1, -1)])
    r = dq.mesolve(H, jumps, psi0, t, exp_ops=[b, a, a.dag() @ a, b.dag() @ b, top_a, top_b], method=METHOD,
                   save_states=False, progress_meter=False)
    e = np.asarray(r.expects)
    return dict(b=e[:, 0], a=e[:, 1], n_a=e[:, 2].real, n_b=e[:, 3].real, top_a=e[:, 4].real, top_b=e[:, 5].real)


def settling_time(t, x, tol=TOL, ref=None):
    """First saved time after which x stays within tol (relative) of ref (default its final value x[-1]; an array
    such as the drift line c0 + c1 t is compared point by point)."""
    ref = x[-1] if ref is None else ref
    out = np.nonzero(np.abs(x - ref) > tol * np.abs(ref))[0]
    return t[0] if out.size == 0 else t[min(out[-1] + 1, len(t) - 1)]


def drift_line(t, x, t0=T_DRIFT):
    """Linear fit of x over t >= t0: intercept c0 (the quasi-steady value) and slope c1. The well contrast decays slowly
    (drive-induced switching), so x(t) -> c0 + c1 t after the ringing, and -c1/c0 is the switching rate."""
    w = t >= t0
    c1, c0 = np.polyfit(t[w], x[w], 1)
    return c0, c1


def rel_slope(t, x, t0=T_DRIFT):
    """Late-time slope of x relative to its quasi-steady value, c1/c0 (1/us)."""
    c0, c1 = drift_line(t, x, t0)
    return c1 / c0


def mean_field_rhs(a, b, eps_Z, alpha=alpha):
    """Two-mode mean-field equations da/dt, db/dt."""
    return (-1j * (2 * G2 * np.conj(a) * b + eps_Z) - KA / 2 * a,
            -1j * (G2 * a**2 - alpha**2 * G2) - KB / 2 * b)


def mean_field(eps_Z, a0, t=T, alpha=alpha):
    """Mean-field a(t), b(t) from a = a0, b = 0."""
    s = solve_ivp(lambda _, y: mean_field_rhs(y[0], y[1], eps_Z, alpha), (t[0], t[-1]), [complex(a0), 0j], t_eval=t,
                  method='DOP853', rtol=1e-11, atol=1e-13)
    return s.y[0], s.y[1]


def jacobian_eigs(eps_Z, a0, b0, alpha=alpha):
    """Eigenvalues of the mean-field equations linearized about (a0, b0), in real coordinates (Re a, Im a, Re b, Im b)."""
    def f(x):
        da, db = mean_field_rhs(x[0] + 1j * x[1], x[2] + 1j * x[3], eps_Z, alpha)
        return np.array([da.real, da.imag, db.real, db.imag])
    x0, h = np.array([a0.real, a0.imag, b0.real, b0.imag]), 1e-6
    return np.linalg.eigvals(np.column_stack([(f(x0 + h * u) - f(x0 - h * u)) / (2 * h) for u in np.eye(4)]))


def first_order(t=T, Md=16, Mb=8, alpha=alpha):
    """Exact quantum response to first order in eps_Z (kappa_a = 0) from |+alpha>|0>, per unit eps_Z: <a> - alpha and <b>
    at times t, their t -> infinity limits, and the eigenvalue (1/us) that carries most of <b>(t). In the displaced frame
    a = alpha + d the Hamiltonian is g2 [(2 alpha d + d^2) b^dag + h.c.] + eps_Z (d + d^dag) and |0_d, 0_b> is dark, so
    rho = |0,0><0,0| + (|chi><0,0| + h.c.)
    with d chi/dt = -i eps_Z |1,0> - i H_eff chi, H_eff = H - i kappa_b b^dag b/2 on the states orthogonal to |0,0>;
    then <d> = <1,0|chi> and <b> = <0,1|chi>. Dropping d^2 gives back the linearized (mean-field) equations."""
    d = np.kron(np.diag(np.sqrt(np.arange(1, Md)), 1), np.eye(Mb))
    b = np.kron(np.eye(Md), np.diag(np.sqrt(np.arange(1, Mb)), 1))
    X = G2 * (2 * alpha * d + d @ d) @ b.T
    w, V = np.linalg.eig((X + X.T - 0.5j * KB * b.T @ b)[1:, 1:])
    c = np.linalg.solve(V, np.eye(len(w))[Mb - 1]) / w           # |1,0> sits at index Mb - 1, |0,1> at 0
    chi = -V @ ((1 - np.exp(-1j * np.outer(w, t))) * c[:, None])  # chi(t) = -H_eff^-1 (1 - exp(-i H_eff t)) |1,0>
    chi_inf = -V @ c
    return chi[Mb - 1], chi[0], chi_inf[Mb - 1], chi_inf[0], -1j * w[np.argmax(np.abs(V[0] * c * w))]


def homodyne_excess(Na, Nb, eps_Z, t_prep=3.0, t_corr=6.0, n=1201):
    """Zero-frequency excess noise of homodyne detection of X = b + b^dag on the output sqrt(kappa_b) b, in units of
    vacuum noise, from the quasi-steady state reached from |+alpha>|0> after t_prep (quantum regression):
    S(0) - 1 = 2 kappa_b int_0^t_corr [Tr(X e^{L tau}(b rho + rho b^dag)) - <X>^2] dtau. Also returns n_b and |<b>|^2."""
    H, jumps, a, b = model(Na, Nb, eps_Z)
    X = b + b.dag()
    rho = dq.mesolve(H, jumps, dq.tensor(dq.coherent(Na, alpha), dq.fock(Nb, 0)), np.array([0.0, t_prep]),
                     method=METHOD, progress_meter=False).final_state
    x0 = complex(dq.expect(X, rho)).real
    tau = np.linspace(0.0, t_corr, n)
    c = dq.mesolve(H, jumps, b @ rho + rho @ b.dag(), tau, exp_ops=[X], method=METHOD, save_states=False,
                   progress_meter=False).expects[0]
    return (2 * KB * np.trapezoid(np.asarray(c).real - x0**2, tau), complex(dq.expect(b.dag() @ b, rho)).real,
            abs(complex(dq.expect(b, rho)))**2)


def run_point(Na, Nb, e):
    f = CACHE / f'{Na}_{Nb}_{e:g}.npz'
    if f.exists():                              # checkpoint: skip finished points
        return dict(np.load(f))
    t0 = time.time()
    d = solve_b(Na, Nb, e * G2)
    print(f'Na={Na:2d} Nb={Nb:2d} eps_Z/g2={e:g}: Re<b>(4 us) = {d["b"][0, -1].real:+.6f} / {d["b"][1, -1].real:+.6f}, '
          f'{time.time() - t0:.0f} s', flush=True)
    np.savez(f, **d)
    return d


def main():
    CACHE.mkdir(exist_ok=True)
    runs = {p: run_point(*p) for p in POINTS}
    lin = lambda e: e / (2 * alpha)             # |Re<b>_ss| = eps_Z/(2 alpha g2) with eps_Z = e g2
    step = lambda t: 1 - np.exp(-GAMMA * t) * (np.cos(OMEGA * t) + GAMMA / OMEGA * np.sin(OMEGA * t))
    print(f'linearized: |Re<b>_ss| = eps_Z/(2 alpha g2) = ' + ', '.join(f'{lin(e):.6f}' for e in EPS)
          + f' for eps_Z/g2 = {EPS}; Im<b>_ss = kappa_a/(4 g2) = {KA / (4 * G2):.6f}', flush=True)
    print(f'linearized dynamics: damping kappa_b/4 = {GAMMA:.3f} /us, period 2pi/omega = {2 * np.pi / OMEGA:.4f} us, '
          f'first overshoot exp(-pi gamma/omega) = {np.exp(-np.pi * GAMMA / OMEGA):.3f}, '
          f'1% envelope time ln(100 sqrt(1 + gamma^2/omega^2))/gamma = '
          f'{np.log(100 * np.hypot(1, GAMMA / OMEGA)) / GAMMA:.3f} us', flush=True)
    fo = {M: first_order(T, *M) for M in ((16, 8), (24, 10))}  # displaced-frame truncation check; 24 x 10 is used
    for (Md, Mb), (_, fb, fa_inf, fb_inf, pole) in fo.items():
        print(f'first-order quantum response (kappa_a = 0, {Md} x {Mb} levels in the displaced frame): well shift '
              f'{(fa_inf / (-1j / (2 * K2 * alpha**2))).real:.5f} x mean field, <b>_ss / (-eps_Z/(2 alpha g2)) = '
              f'{-fb_inf * 2 * alpha * G2:.6f}, dominant eigenvalue {pole.real:.4f} +/- {abs(pole.imag):.4f}i /us '
              f'(period {2 * np.pi / abs(pole.imag):.4f} us) against {-GAMMA:.3f} +/- {OMEGA:.3f}i linearized', flush=True)
    print(f'first-order response 16 x 8 vs 24 x 10: max |d<b>(t)| / max |<b>| = '
          f'{np.abs(fo[16, 8][1] - fo[24, 10][1]).max() / np.abs(fo[24, 10][1]).max():.1e}', flush=True)
    fo_a, fo_b, fo_a_inf, fo_b_inf, pole = fo[24, 10]
    fo_shift = (fo_a_inf / (-1j / (2 * K2 * alpha**2))).real    # first-order well shift / mean-field well shift
    fo_r = -2 * alpha * G2 * fo_b.real                           # first-order half contrast / (eps_Z/(2 alpha g2))
    a_mf0, b_mf0 = mean_field(0.0, alpha)
    fmt = lambda v: ', '.join(f'{x.real:.4f}{x.imag:+.4f}i' for x in sorted(v, key=lambda x: (x.imag, x.real)))
    print(f'mean-field Jacobian eigenvalues at the +alpha well, eps_Z = 0: [{fmt(jacobian_eigs(0.0, a_mf0[-1], b_mf0[-1]))}] /us',
          flush=True)

    # truncation and convergence: every point, both codewords
    q = {}
    for (Na, Nb, e), d in runs.items():
        fit = [drift_line(T, d['b'][k]) for k in (0, 1)]
        re, im = np.array([c0.real for c0, _ in fit]), np.array([c0.imag for c0, _ in fit])
        ts = [settling_time(T, d['b'][k].real, ref=(c0 + c1 * T).real) for k, (c0, c1) in enumerate(fit)]
        lam = -rel_slope(T, d['a'][0].real)
        q[Na, Nb, e] = dict(re=re, im=im, ts=ts, b=d['b'], lam=lam)
        print(f'Na={Na:2d} Nb={Nb:2d} eps_Z/g2={e:g}: quasi-steady Re<b> = {re[0]:+.7f} / {re[1]:+.7f}, '
              f'Im<b> = {im[0]:+.7f} / {im[1]:+.7f}, settles at {ts[0]:.3f} / {ts[1]:.3f} us, '
              f'switching rate -dRe<a>/dt / Re<a> = {lam:.3e} /us, '
              f'max top-2 memory {d["top_a"].max():.1e}, max top buffer {d["top_b"].max():.1e}, '
              f'max n_b {d["n_b"].max():.4f}', flush=True)
    for e in EPS:
        ref = q[(*MAIN_SIZE, e)]
        for Na, Nb in SIZES[:-1] + [REF_SIZE]:
            o = q[Na, Nb, e]
            print(f'convergence eps_Z/g2={e:g}: {Na}x{Nb} vs {MAIN_SIZE[0]}x{MAIN_SIZE[1]}: '
                  f'Re<b> rel. diff {np.abs(o["re"] - ref["re"]).max() / np.abs(ref["re"]).max():.1e}, '
                  f'Im<b> rel. diff {np.abs(o["im"] - ref["im"]).max() / np.abs(ref["im"]).max():.1e}, '
                  f'switching rate rel. diff {o["lam"] / ref["lam"] - 1:+.1e}, '
                  f'settling diff {np.abs(np.subtract(o["ts"], ref["ts"])).max():.3f} us, whole trace max |d<b>(t)| / max |<b>| '
                  f'{np.abs(o["b"] - ref["b"]).max() / np.abs(ref["b"]).max():.1e}', flush=True)

    # physics at the main truncation
    summary = {}
    for e in EPS:
        d, eps_Z = runs[(*MAIN_SIZE, e)], e * G2
        b, a = d['b'], d['a']
        r = (b[1].real - b[0].real) / 2                          # half contrast, +eps_Z/(2 alpha g2) at linear order
        r_ss, r_slope = drift_line(T, r)                         # quasi-steady value (t = 0 intercept) and drift
        line = r_ss + r_slope * T
        b_ss = [drift_line(T, b[k])[0] for k in (0, 1)]
        a_ss = [drift_line(T, a[k])[0] for k in (0, 1)]
        lam = -rel_slope(T, a[0].real)                          # relative decay rate of Re<a>
        mf = [mean_field(eps_Z, s * alpha) for s in (1, -1)]
        print(f'eps_Z/g2={e:g} (eps_Z = {eps_Z:.4f} rad/us): quasi-steady <b>_ss = {b_ss[0]:.6f} (+alpha), '
              f'{b_ss[1]:.6f} (-alpha) (<b>(4 us) = {b[0, -1]:.6f}); '
              f'Re/linear = {b_ss[0].real / -lin(e):.4f} / {b_ss[1].real / lin(e):.4f}; '
              f'Im/(kappa_a/4g2) = {b_ss[0].imag / (KA / (4 * G2)):.3f} / {b_ss[1].imag / (KA / (4 * G2)):.3f}; '
              f'mean field {mf[0][1][-1]:.6f} / {mf[1][1][-1]:.6f}; contrast |<b>_+ - <b>_-| = '
              f'{abs(b_ss[0] - b_ss[1]):.6f} vs eps_Z/(alpha g2) = {2 * lin(e):.6f}', flush=True)
        print(f'eps_Z/g2={e:g}: slow drift (linear fit on {T_DRIFT:g}-{T[-1]:g} us, n = {(T >= T_DRIFT).sum()}): '
              f'-dRe<a>/dt / Re<a> = {lam:.3e} /us, -dRe<b>/dt / Re<b> = {-r_slope / r_ss:.3e} /us, '
              f'relative slopes of Im<b> {rel_slope(T, b[0].imag):+.1e} and n_a '
              f'{rel_slope(T, d["n_a"][0]):+.1e} /us; switching rate / Gamma_X(eps_Z = 0) = '
              f'{lam / GAMMA_X0:.1f} (Gamma_X = {GAMMA_X0:.3e} /us, Task 2.1)', flush=True)
        shift = -eps_Z / (2 * K2 * alpha**2)
        print(f'eps_Z/g2={e:g}: Im<a>_ss = {a_ss[0].imag:+.6f} / {a_ss[1].imag:+.6f} vs '
              f'-eps_Z/(2 kappa2 alpha^2) = {shift:+.6f} (ratio {a_ss[0].imag / shift:.4f}, first-order quantum '
              f'{fo_shift:.4f}); Re<a>_ss = {a_ss[0].real:+.5f} / {a_ss[1].real:+.5f}', flush=True)
        fits = [drift_line(T, b[k].real) for k in (0, 1)]
        ts = [settling_time(T, b[k].real, ref=c0 + c1 * T) for k, (c0, c1) in enumerate(fits)]
        ts_mf = settling_time(T, mf[0][1].real)
        dev = -b[0].real - line
        cross = np.count_nonzero(np.diff(np.sign(dev[T < ts[0]])) != 0)
        over = (-b[0].real / line).max() - 1
        print(f'eps_Z/g2={e:g}: Re<b> within {TOL:.0%} of its quasi-steady value after {ts[0]:.3f} / {ts[1]:.3f} us '
              f'(mean field {ts_mf:.3f} us); first overshoot {over:.3f}; crosses it {cross} times before settling', flush=True)
        w = (T >= T_FIT[0]) & (T <= T_FIT[1])
        cosine = lambda t, A, g, om, ph: A * np.exp(-g * t) * np.cos(om * t + ph)
        p0 = [-r_ss * np.hypot(1, GAMMA / OMEGA), GAMMA, OMEGA, -np.arctan(GAMMA / OMEGA)]
        p, _ = curve_fit(cosine, T[w], r[w] - line[w], p0=p0)
        resid = np.abs(r[w] - line[w] - cosine(T[w], *p)).max() / r_ss
        spread = np.array([curve_fit(cosine, T[(T >= t0) & (T <= T_FIT[1])], (r - line)[(T >= t0) & (T <= T_FIT[1])],
                                     p0=p)[0][1:3] for t0 in np.arange(0.5, 1.01, 0.1)])
        y = np.abs(r - line)
        ext = np.nonzero((y[1:-1] > y[:-2]) & (y[1:-1] >= y[2:]) & (T[1:-1] < 1.0))[0] + 1   # extrema before 1 us
        env = -np.polyfit(T[ext], np.log(y[ext]), 1)[0]
        print(f'eps_Z/g2={e:g}: damped-cosine fit of the half contrast minus its drift line on {T_FIT[0]:g}-{T_FIT[1]:g} us '
              f'(n = {w.sum()}): rate {p[1]:.3f} /us (kappa_b/4 = {GAMMA:.3f}), period {2 * np.pi / p[2]:.4f} us '
              f'(linearized {2 * np.pi / OMEGA:.4f}), max residual {resid:.1e} of the steady value; window start 0.5-1.0 us: '
              f'rate {spread[:, 0].min():.3f}-{spread[:, 0].max():.3f} /us, period {2 * np.pi / spread[:, 1].max():.4f}-'
              f'{2 * np.pi / spread[:, 1].min():.4f} us; decay of the first {ext.size} extrema {env:.3f} /us; '
              f'max |r/r_ss - linear step response| = {np.abs(r / r_ss - step(T)).max():.3f}, '
              f'max |r/(eps_Z/(2 alpha g2)) - first-order quantum response| = {np.abs(r / lin(e) - fo_r).max():.1e}', flush=True)
        print(f'eps_Z/g2={e:g}: mean-field Jacobian eigenvalues at the +alpha well: '
              f'[{fmt(jacobian_eigs(eps_Z, mf[0][0][-1], mf[0][1][-1]))}] /us', flush=True)
        # readout: homodyne of the output field sqrt(kappa_b) b; a constant field over tau gives amplitude sqrt(kappa_b tau) Re<b>
        tau = erfcinv(2 * P_ERR)**2 / (2 * KB * r_ss**2)
        dead = np.trapezoid(1 - (r / line)**2, T)                # matched-filter signal lost to the transient
        n_b = drift_line(T, d['n_b'][0])[0]
        print(f'eps_Z/g2={e:g}: output field sqrt(kappa_b) |Re<b>_ss| = {np.sqrt(KB) * r_ss:.4f} us^-1/2, '
              f'coherent photon flux kappa_b |<b>_ss|^2 = {KB * abs(b_ss[0])**2:.5f} /us, total kappa_b n_b = '
              f'{KB * n_b:.5f} /us (n_b = {n_b:.4e}, |<b>_ss|^2 = {abs(b_ss[0])**2:.4e}), '
              f'ideal homodyne window for {P_ERR:.0%} assignment error {tau:.1f} us, contrast decay over it '
              f'lambda tau = {lam * tau:.2e}, matched-filter dead time of the transient {dead:+.3f} us', flush=True)
        summary[e] = dict(r=r, mf=mf, ts=ts, tau=tau)

    # homodyne noise from the incoherent buffer population (quantum regression), cached per point
    for Na, Nb, e in [(*NOISE_SIZE, e) for e in EPS] + [(*NOISE_REF, MAIN_EPS)]:
        f = CACHE / f'noise_{Na}_{Nb}_{e:g}.npz'
        if not f.exists():
            np.savez(f, v=homodyne_excess(Na, Nb, e * G2))
        ex, n_b, b2 = np.load(f)['v']
        print(f'eps_Z/g2={e:g}, {Na}x{Nb}: zero-frequency homodyne excess noise S(0) - 1 = {ex:+.3e} of vacuum noise '
              f'(quantum regression over 0-6 us from the state at 3 us; n_b = {n_b:.4e}, |<b>|^2 = {b2:.4e})', flush=True)

    # plots
    d, e = runs[(*MAIN_SIZE, MAIN_EPS)], MAIN_EPS
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for k, lab in enumerate((r'$|{+}\alpha\rangle$', r'$|{-}\alpha\rangle$')):
        ax.plot(T, d['b'][k].real, color=COLORS[k], lw=2, label=lab)
    for k, s in enumerate((1, -1)):
        ax.plot(T, summary[e]['mf'][k][1].real, color='k', ls=':', lw=1.4, label='Mean field' if k == 0 else None)
        ax.axhline(-s * lin(e), color='gray', ls='--', lw=1.4,
                   label=r'$\mp\epsilon_Z/2\alpha g_2$' if k == 0 else None)
    ax.set_xlim(0, 2.5)
    style(ax, r'$t$ ($\mu$s)', r'Re $\langle b\rangle$', rf'2.3 Buffer field, $\epsilon_Z = {e:g}\,g_2$')
    plt.tight_layout()
    save(fig, 'task2_3_b_trace.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for i, e in enumerate(EPS):
        b = runs[(*MAIN_SIZE, e)]['b']
        for k in (0, 1):
            ax.plot(b[k].real, b[k].imag, color=COLORS[i], lw=1.5, label=rf'$\epsilon_Z = {e:g}\,g_2$' if k == 0 else None)
            ax.plot(b[k, -1].real, b[k, -1].imag, 'o', color=COLORS[i], mec='black', ms=7, zorder=3)
    for e in EPS:
        ax.plot([-lin(e), lin(e)], [KA / (4 * G2)] * 2, 'x', color='black', ms=11, mew=1.5, zorder=2,
                label='Linearized' if e == EPS[0] else None)
    ax.axvline(0, color='gray', lw=1)
    style(ax, r'Re $\langle b\rangle$', r'Im $\langle b\rangle$', r'2.3 $\langle b\rangle(t)$ from $|\pm\alpha\rangle$')
    plt.tight_layout()
    save(fig, 'task2_3_b_plane.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    ax.axhspan(1 - TOL, 1 + TOL, color='gray', alpha=0.3, lw=0, label=rf'$\pm${TOL:.0%}')
    for i, e in enumerate(EPS):
        ax.plot(T, summary[e]['r'] / lin(e), color=COLORS[i], lw=[5, 3, 1.5][i], label=rf'$\epsilon_Z = {e:g}\,g_2$')
    ax.plot(T, fo_r, color='k', ls=':', lw=1.4, label='First-order quantum')
    ax.plot(T, step(T), color='k', ls='--', lw=1.4, label='Linearized')
    ax.set_xlim(0, 2)
    style(ax, r'$t$ ($\mu$s)', r'$(\mathrm{Re}\langle b\rangle_- - \mathrm{Re}\langle b\rangle_+)\,\alpha g_2/\epsilon_Z$',
          '2.3 Contrast, scaled by the drive')
    plt.tight_layout()
    save(fig, 'task2_3_linearity.png')

    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for (Na, Nb), ls in ((MAIN_SIZE, '-'), (SIZES[1], '--')):
        dd = runs[(Na, Nb, MAIN_EPS)]
        ax.semilogy(T, np.clip(np.abs(dd['top_a']).max(0), 1e-16, None), color=COLORS[0], ls=ls, lw=2,
                    label=rf'Memory $|{Na - 2}\rangle + |{Na - 1}\rangle$')
        ax.semilogy(T, np.clip(np.abs(dd['top_b']).max(0), 1e-16, None), color=COLORS[1], ls=ls, lw=2,
                    label=rf'Buffer $|{Nb - 1}\rangle$')
    ax.set_ylim(1e-16, 1)
    style(ax, r'$t$ ($\mu$s)', 'Population', rf'2.3 Truncation check, $\epsilon_Z = {MAIN_EPS:g}\,g_2$')
    plt.tight_layout()
    save(fig, 'task2_3_truncation.png')

    np.savez(RESULTS / 'task2_3.npz', t=T, eps=EPS, **{f'b_{Na}_{Nb}_{e:g}': v['b'] for (Na, Nb, e), v in runs.items()},
             **{f'a_{Na}_{Nb}_{e:g}': v['a'] for (Na, Nb, e), v in runs.items()})
    print(f'wrote {RESULTS / "task2_3.npz"}', flush=True)


if __name__ == '__main__':
    if len(sys.argv) > 1:
        CACHE.mkdir(exist_ok=True)
        run_point(*POINTS[int(sys.argv[1])])
    else:
        main()
