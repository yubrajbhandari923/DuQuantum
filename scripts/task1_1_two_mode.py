"""Task 1.1 full two-mode model: inflate the cat from vacuum in memory and buffer, compare with the memory-only model."""
import dynamiqs as dq
import jax.numpy as jnp
import numpy as np

from common import METHOD, COLORS, RESULTS, alpha, g2, kappa2, kappa_a, kappa_b, save, style, wigner_mosaic
import matplotlib.pyplot as plt

Na, Nb = 32, 12                                    # smallest sizes that converge the overshoot peak to 0.1% (Task 1.2)
eps_d = alpha**2 * g2
a, b = dq.destroy(Na, Nb)
H = g2 * (a @ a @ b.dag()) + g2 * (a.dag() @ a.dag() @ b) - eps_d * (b + b.dag())
jump_ops = [jnp.sqrt(kappa_b) * b, jnp.sqrt(kappa_a) * a]
psi0 = dq.tensor(dq.fock(Na, 0), dq.fock(Nb, 0))
t = jnp.linspace(0.0, 3.0, 601)
print(f'g2/kappa_b = {g2 / kappa_b:.3f}, eps_d/kappa_b = {eps_d / kappa_b:.3f}', flush=True)

# save only the memory state (buffer traced out) and the buffer populations; full states would need ~4 GB
res = dq.mesolve(H, jump_ops, psi0, t, method=METHOD, save_states=False,
                 save_extra=lambda _, rho: (dq.ptrace(rho, 0).to_jax(), jnp.diagonal(dq.ptrace(rho, 1).to_jax()).real))
rho_a, pb = res.extra
pa = jnp.diagonal(rho_a, axis1=-2, axis2=-1).real
n_a, n_b = pa @ jnp.arange(Na), pb @ jnp.arange(Nb)
top_a, top_b = pa[:, -2:].sum(1), pb[:, -1]

# memory-only model of Task 1.0(c), nominal kappa2, same time grid
N = 30
c = dq.destroy(N)
res_eff = dq.mesolve(dq.zeros(N), [jnp.sqrt(kappa2) * (c @ c - alpha**2 * dq.eye(N)), jnp.sqrt(kappa_a) * c],
                     dq.fock(N, 0), t, exp_ops=[c.dag() @ c], save_states=False, method=METHOD)
n_eff = res_eff.expects[0].real

ia, ib = int(jnp.argmax(n_a)), int(jnp.argmax(n_b))
out = jnp.nonzero(jnp.abs(n_a - alpha**2) > 0.01 * alpha**2)[0]
print(f'memory: peak {n_a[ia]:.3f} at {t[ia]:.3f} us, n(3 us) = {n_a[-1]:.4f} vs alpha^2 = {alpha**2:.2f}, '
      f'within 1% of alpha^2 after {t[out[-1] + 1]:.3f} us', flush=True)
print(f'buffer: peak {n_b[ib]:.3f} at {t[ib]:.3f} us, n(3 us) = {n_b[-1]:.2e}', flush=True)
print(f'truncation: max memory top-2 population {top_a.max():.2e}, max buffer top population {top_b.max():.2e} '
      f'at {t[int(jnp.argmax(top_b))]:.3f} us', flush=True)
print(f'memory-only model: max {n_eff.max():.4f}, n(3 us) = {n_eff[-1]:.4f}', flush=True)

fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
ax.plot(t, n_a, color=COLORS[0], lw=2, label=r'Memory $\langle a^\dagger a\rangle$')
ax.plot(t, n_b, color=COLORS[1], lw=2, label=r'Buffer $\langle b^\dagger b\rangle$')
ax.axhline(alpha**2, color='k', ls='--', lw=1.4, label=r'$\alpha^2$')
style(ax, r'$t$ ($\mu$s)', 'Mean photon number', '1.1 Inflating a cat')
plt.tight_layout()
save(fig, 'task1_1_photon_number.png')

fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
ax.semilogy(t, np.clip(np.abs(top_a), 1e-12, None), color=COLORS[0], lw=2, label=rf'Memory $|{Na - 2}\rangle + |{Na - 1}\rangle$')
ax.semilogy(t, np.clip(np.abs(top_b), 1e-12, None), color=COLORS[1], lw=2, label=rf'Buffer $|{Nb - 1}\rangle$')
ax.set_ylim(1e-10, 1)
style(ax, r'$t$ ($\mu$s)', 'Population', rf'1.1 Truncation check, $N_a = {Na}$, $N_b = {Nb}$')
plt.tight_layout()
save(fig, 'task1_1_truncation.png')

snap = [0.0, 0.05, 0.1, 0.2, 0.3, 0.5, 1.0, 3.0]
idx = [int(round(s / float(t[1] - t[0]))) for s in snap]
wigner_mosaic([rho_a[i] for i in idx], snap, 'task1_1_wigner.png', '1.1 Memory Wigner function, buffer traced out',
              xmax=3.5, ncols=4)

fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
ax.plot(t, n_a, color=COLORS[0], lw=2, label='Memory and buffer')
ax.plot(t, n_eff, color=COLORS[2], lw=2, label='Memory only, 1.0(c)')
ax.axhline(alpha**2, color='k', ls='--', lw=1.4, label=r'$\alpha^2$')
style(ax, r'$t$ ($\mu$s)', r'$\langle a^\dagger a\rangle$', '1.1 Two-mode against memory-only')
plt.tight_layout()
save(fig, 'task1_1_vs_memory_only.png')

np.savez(RESULTS / 'task1_1.npz', t=t, n_a=n_a, n_b=n_b, top_a=top_a, top_b=top_b, n_eff=n_eff, rho_a=rho_a,
         pa=pa, pb=pb, Na=Na, Nb=Nb)
print(f'wrote {RESULTS / "task1_1.npz"}', flush=True)
