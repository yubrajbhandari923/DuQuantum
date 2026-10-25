#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task1_2
#SBATCH --cpus-per-task=2
#SBATCH --mem=3gb
#SBATCH --time=0:30:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%j.out
# Task 1.2 convergence study (11 two-mode runs up to N_a N_b = 640), then Task 1.1 at the reference sizes 40 x 16.
# CPU only; job 16153736 ran 8 points up to 384 in 3:11 at 0.87 GB, the extension is estimated at about 17 min.
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg
.venv/bin/python scripts/task1_2_convergence.py && .venv/bin/python scripts/task1_1_two_mode.py
