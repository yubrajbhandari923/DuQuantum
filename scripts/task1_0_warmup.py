"""Task 1.0 warm-up on the memory alone: one-photon loss, two-photon loss, two-photon stabilization."""
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import dynamiqs as dq
import jax.numpy as jnp
import numpy as np

try:
    import scienceplots  # noqa: F401
    plt.style.use(['science', 'no-latex', 'bright'])
except ImportError:
    plt.style.use('default')

dq.set_precision('double')

ROOT = Path(__file__).resolve().parents[1]
PLOTS, RESULTS = ROOT / 'plots', ROOT / 'results'
PLOTS.mkdir(exist_ok=True)
RESULTS.mkdir(exist_ok=True)

COLORS = ['tab:blue', 'tab:orange', 'tab:green', 'tab:red', 'tab:purple']
TWO_PI = 2 * jnp.pi

# provided parameters, rad/us
g2 = TWO_PI * 0.763
kappa_b = TWO_PI * 2.6
kappa_a = TWO_PI * 9.3e-3
alpha = 2.1
kappa2 = 4 * g2**2 / kappa_b

N = 30
a = dq.destroy(N)
n_op = a.dag() @ a


def set_spine_width(ax, lw=1.5):
    for s in ax.spines.values():
        s.set_linewidth(lw)


def style(ax, xlabel, ylabel, title):
    ax.set_xlabel(xlabel, fontsize=18)
    ax.set_ylabel(ylabel, fontsize=18)
    ax.set_title(title, fontsize=20)
    ax.tick_params(labelsize=16)
    ax.legend(fontsize=14, frameon=True, edgecolor='black')
    set_spine_width(ax)


def save(fig, name):
    fig.savefig(PLOTS / name, dpi=400, bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {PLOTS / name}', flush=True)


def wigner_mosaic(states, times, name, title, xmax, centers=None, path=None):
    fig, axes = plt.subplots(2, 3, figsize=(15, 10), dpi=300, layout='constrained')
    for ax, rho, t in zip(axes.flat, states, times):
        dq.plot.wigner(rho, ax=ax, xmax=xmax, npixels=201, colorbar=False)
        if path is not None:
            ax.plot(path.real, path.imag, color='black', lw=0.8)
        if centers is not None:
            c = centers[times.index(t)]
            ax.plot(c.real, c.imag, 'o', mfc='none', mec='black', ms=6)
        ax.set_title(rf'$t$ = {t:g} $\mu$s', fontsize=20)
        ax.set_xlabel(r'Re $\alpha$', fontsize=18)
        ax.set_ylabel(r'Im $\alpha$', fontsize=18)
        ax.tick_params(labelsize=16)
        ax.label_outer()
        set_spine_width(ax)
    cb = fig.colorbar(axes.flat[0].images[0], ax=axes, shrink=0.8)
    cb.set_label(r'$W(\alpha)$', fontsize=18)
    cb.ax.tick_params(labelsize=16)
    fig.suptitle(title, fontsize=20)
    save(fig, name)


# (a) rotation plus one-photon loss, exaggerated kappa
Delta, kappa, alpha0 = TWO_PI * 1.0, TWO_PI * 1.0, 2.0
t_a = jnp.linspace(0.0, 1.0, 201)
res_a = dq.mesolve(Delta * n_op, [jnp.sqrt(kappa) * a], dq.coherent(N, alpha0), t_a, exp_ops=[n_op])
n_a = res_a.expects[0].real
n_a_exact = alpha0**2 * jnp.exp(-kappa * t_a)
center_a = alpha0 * jnp.exp(-(1j * Delta + kappa / 2) * t_a)  # |alpha0 e^{-(i Delta + kappa/2) t}>
psi = dq.coherent(N, center_a).to_jax()[..., 0]
fid_a = jnp.einsum('ti,tij,tj->t', psi.conj(), res_a.states.to_jax(), psi).real
print(f'(a) max |n_sim - n_exact| = {jnp.max(jnp.abs(n_a - n_a_exact)):.2e}, '
      f'min fidelity with the shrinking coherent state = {fid_a.min():.8f}', flush=True)

fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
ax.plot(t_a, n_a, color=COLORS[0], lw=2, label='Simulation')
ax.plot(t_a, n_a_exact, 'k--', lw=1.4, label=r'$|\alpha_0|^2 e^{-\kappa t}$')
style(ax, r'$t$ ($\mu$s)', r'$\langle a^\dagger a \rangle$', '1.0(a) Single-photon loss,\nin physical units')
plt.tight_layout()
save(fig, 'task1_0a_photon_number.png')

snap_a = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
idx = [int(round(t / (t_a[1] - t_a[0]))) for t in snap_a]
wigner_mosaic([res_a.states[i] for i in idx], snap_a, 'task1_0a_wigner.png',
              r'1.0(a) Single-photon loss, in physical units. Wigner function, circle at $\alpha_0 e^{-(i\Delta + \kappa/2)t}$',
              xmax=3.0, centers=[center_a[i] for i in idx], path=center_a)

# (b) pure two-photon loss
t_b = jnp.linspace(0.0, 1.0, 1001)
res_b = dq.mesolve(dq.zeros(N), [jnp.sqrt(kappa2) * a @ a], dq.coherent(N, alpha0), t_b,
                   exp_ops=[n_op], save_states=False)
n_b = res_b.expects[0].real
n_b_exact = (1 - jnp.exp(-2 * alpha0**2)) / 2  # odd-parity weight of |alpha0>, all of it ends in |1>
print(f'(b) n(1 us) = {n_b[-1]:.6f}, analytic plateau = {n_b_exact:.6f}, '
      f'|n(1 us) - n(0.5 us)| = {abs(n_b[-1] - n_b[500]):.2e}', flush=True)

fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
ax.plot(t_b, n_b, color=COLORS[0], lw=2, label='Simulation')
ax.axhline(n_b_exact, color='k', ls='--', lw=1.4, label=r'$(1 - e^{-2|\alpha_0|^2})/2$')
style(ax, r'$t$ ($\mu$s)', r'$\langle a^\dagger a \rangle$', '1.0(b) Pure two-photon loss')
plt.tight_layout()
save(fig, 'task1_0b_photon_number.png')

# (c) two-photon stabilization at kappa2/4, kappa2, 4 kappa2, batched in one call
scales = jnp.array([0.25, 1.0, 4.0])
L2 = jnp.sqrt(scales * kappa2)[:, None, None] * (a @ a - alpha**2 * dq.eye(N))
t_c = jnp.linspace(0.0, 2.0, 401)
res_c = dq.mesolve(dq.zeros(N), [L2, jnp.sqrt(kappa_a) * a], dq.fock(N, 0), t_c, exp_ops=[n_op])
n_c = res_c.expects[:, 0].real
for s, n in zip(scales, n_c):
    out = jnp.nonzero(jnp.abs(n - n[-1]) > 0.01 * n[-1])[0]
    t_settle = t_c[out[-1] + 1]
    print(f'(c) {s:g} kappa2: n(2 us) = {n[-1]:.4f}, within 1% of it after {t_settle:.3f} us, '
          f'kappa2 * t_settle = {s * kappa2 * t_settle:.3f}', flush=True)

fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
for k, (s, lab) in enumerate(zip(scales, [r'$\kappa_2/4$', r'$\kappa_2$', r'$4\kappa_2$'])):
    ax.plot(t_c, n_c[k], color=COLORS[k], lw=2, label=lab)
ax.axhline(alpha**2, color='k', ls='--', lw=1.4, label=r'$\alpha^2$')
style(ax, r'$t$ ($\mu$s)', r'$\langle a^\dagger a \rangle$', '1.0(c) Stabilization:\ntwo-photon loss + two-photon drive')
plt.tight_layout()
save(fig, 'task1_0c_photon_number.png')

snap_c = [0.0, 0.02, 0.05, 0.1, 0.3, 2.0]
idx = [int(round(t / (t_c[1] - t_c[0]))) for t in snap_c]
wigner_mosaic([res_c.states[1, i] for i in idx], snap_c, 'task1_0c_wigner.png',
              r'1.0(c) Stabilization: two-photon loss + two-photon drive. Wigner function at nominal $\kappa_2$', xmax=3.5)

np.savez(RESULTS / 'task1_0.npz', t_a=t_a, n_a=n_a, n_a_exact=n_a_exact, fid_a=fid_a,
         t_b=t_b, n_b=n_b, t_c=t_c, n_c=n_c, kappa2_scales=scales, kappa2=kappa2)
print(f'wrote {RESULTS / "task1_0.npz"}', flush=True)
