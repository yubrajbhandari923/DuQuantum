"""Task 1.2 semiclassical check of the steady state and convergence study of the two-mode model in N_a and N_b."""
import time

import dynamiqs as dq
import jax.numpy as jnp
import numpy as np

from common import METHOD, COLORS, RESULTS, alpha, g2, kappa2, kappa_a, kappa_b, save, set_spine_width, style
import matplotlib.pyplot as plt

T = jnp.linspace(0.0, 3.0, 601)
TOL = 1e-3                                  # relative change below which a quantity counts as converged
NA_SWEEP, NB_FIXED = [16, 20, 24, 32, 40], 16       # memory sweep with the largest buffer
NB_SWEEP, NA_FIXED = [4, 6, 8, 10, 12, 14, 16], 40  # buffer sweep with the largest memory
PLOT_NB = [4, 6, 8, 12, 16]                         # five curves, one per house color
CACHE = RESULTS / 'task1_2'
CACHE.mkdir(exist_ok=True)


def run(Na, Nb):
    f = CACHE / f'{Na}_{Nb}.npz'
    if f.exists():                              # checkpoint: skip finished points
        d = np.load(f)
        return d['n_a'], d['n_b']
    a, b = dq.destroy(Na, Nb)
    H = g2 * (a @ a @ b.dag()) + g2 * (a.dag() @ a.dag() @ b) - alpha**2 * g2 * (b + b.dag())
    t0 = time.time()
    r = dq.mesolve(H, [jnp.sqrt(kappa_b) * b, jnp.sqrt(kappa_a) * a], dq.tensor(dq.fock(Na, 0), dq.fock(Nb, 0)), T,
                   exp_ops=[a.dag() @ a, b.dag() @ b], save_states=False, method=METHOD, progress_meter=False)
    n_a, n_b = np.asarray(r.expects[0].real), np.asarray(r.expects[1].real)
    print(f'Na={Na:2d} Nb={Nb:2d}: peak {n_a.max():.4f} at {T[n_a.argmax()]:.3f} us, n(3 us) {n_a[-1]:.5f}, '
          f'{time.time() - t0:.0f} s', flush=True)
    np.savez(f, n_a=n_a, n_b=n_b)
    return n_a, n_b


runs = {(Na, NB_FIXED): run(Na, NB_FIXED) for Na in NA_SWEEP}
runs.update({(NA_FIXED, Nb): run(NA_FIXED, Nb) for Nb in NB_SWEEP if (NA_FIXED, Nb) not in runs})

QUANTITIES = {'peak': lambda n: n.max(), 'steady': lambda n: n[-1]}
rel = {}
for name, keys in (('Na', [(Na, NB_FIXED) for Na in NA_SWEEP]), ('Nb', [(NA_FIXED, Nb) for Nb in NB_SWEEP])):
    for q, f in QUANTITIES.items():
        vals = np.array([f(runs[k][0]) for k in keys])
        rel[name, q] = np.abs(vals - vals[-1]) / vals[-1]
        Ns = [k[0] if name == 'Na' else k[1] for k in keys]
        ok = [N for i, N in enumerate(Ns) if np.all(rel[name, q][i:] < TOL)]
        print(f'{q} vs {name}: ' + ', '.join(f'{N}: {v:.4f}' for N, v in zip(Ns, vals))
              + f' -> converged to {TOL:g} from {name} = {ok[0]}', flush=True)

steady = runs[(NA_FIXED, NB_FIXED)][0][-1]
print(f'semiclassical: n(3 us) = {steady:.4f} vs alpha^2 = {alpha**2:.2f} ({(steady - alpha**2) / alpha**2:+.2%}), '
      f'memory-only mean field alpha^2 - kappa_a/2kappa2 = {alpha**2 - kappa_a / (2 * kappa2):.4f}', flush=True)

for name, Ns, fixed, fname in (('b', PLOT_NB, NA_FIXED, 'task1_2_nb_sweep.png'),
                               ('a', NA_SWEEP, NB_FIXED, 'task1_2_na_sweep.png')):
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    for k, N in enumerate(Ns):
        n_a = runs[(fixed, N) if name == 'b' else (N, fixed)][0]
        ax.plot(T, n_a, color=COLORS[k], lw=2, label=rf'$N_{name} = {N}$')
    ax.axhline(alpha**2, color='k', ls='--', lw=1.4, label=r'$\alpha^2$')
    ax.set_xlim(0, 1.5)
    other = 'a' if name == 'b' else 'b'
    style(ax, r'$t$ ($\mu$s)', r'$\langle a^\dagger a\rangle$', rf'1.2 Memory photon number, $N_{other} = {fixed}$')
    plt.tight_layout()
    save(fig, fname)

fig, axes = plt.subplots(1, 2, figsize=(10, 4.5), dpi=300)
for ax, (name, Ns) in zip(axes, (('Na', NA_SWEEP), ('Nb', NB_SWEEP))):
    for k, (q, label) in enumerate((('peak', 'Overshoot peak'), ('steady', r'$\langle a^\dagger a\rangle$ at 3 $\mu$s'))):
        r = rel[name, q][:-1]                   # the last point is the reference
        ax.semilogy(Ns[:-1], np.clip(r, 1e-12, None), marker=['o', 's'][k], color=COLORS[k], ms=6, mec='black',
                    lw=1.5, label=label)
    ax.axhline(TOL, color='k', ls='--', lw=1.4, label=f'tolerance {TOL:g}')
    ax.set_xticks(Ns[:-1])
    fixed = rf'$N_b = {NB_FIXED}$' if name == 'Na' else rf'$N_a = {NA_FIXED}$'
    style(ax, rf'$N_{name[1]}$', f'Relative change from $N_{name[1]} = {Ns[-1]}$', f'1.2 Convergence in $N_{name[1]}$, {fixed}')
axes[0].get_legend().remove()
plt.tight_layout()
save(fig, 'task1_2_convergence.png')

np.savez(RESULTS / 'task1_2.npz', t=T, **{f'n_a_{Na}_{Nb}': v[0] for (Na, Nb), v in runs.items()},
         **{f'n_b_{Na}_{Nb}': v[1] for (Na, Nb), v in runs.items()})
print(f'wrote {RESULTS / "task1_2.npz"}', flush=True)
