#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task2_2
#SBATCH --cpus-per-task=2
#SBATCH --mem=4gb
#SBATCH --time=1:01:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%j.out
# Task 2.2 parity decay of the even cat: 8 alphas x 3 truncations (largest 36 x 8 = 288 states, about 3 us), the slowest
# even-sector Liouvillian modes at each of the 24 points, fits, plots. CPU only; finished points and modes are cached, so a
# rerun only redoes the analysis (26 s in job 16161992). Job 16159301 ran the 24 mesolve points in 4:12 (1.2 cores, 1.23 GB).
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg
.venv/bin/python scripts/task2_2_phase_flip.py
