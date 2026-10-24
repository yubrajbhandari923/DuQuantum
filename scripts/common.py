"""Shared parameters, plot style and helpers for the task scripts."""
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import dynamiqs as dq
import jax.numpy as jnp

try:
    import scienceplots  # noqa: F401
    plt.style.use(['science', 'no-latex', 'bright'])
except ImportError:
    plt.style.use('default')

dq.set_precision('double')
METHOD = dq.method.Tsit5(rtol=1e-10, atol=1e-10)  # the default 1e-6 leaves ~1e-4 noise in small populations

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


def wigner_mosaic(states, times, name, title, xmax, centers=None, path=None, ncols=3):
    nrows = -(-len(states) // ncols)
    fig, axes = plt.subplots(nrows, ncols, figsize=(5 * ncols, 5 * nrows), dpi=300, layout='constrained')
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
