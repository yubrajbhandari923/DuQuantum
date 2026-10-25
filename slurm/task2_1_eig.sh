#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task2_1-eig
#SBATCH --array=0-8
#SBATCH --cpus-per-task=1
#SBATCH --mem=32gb
#SBATCH --time=3:00:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%A_%a.out
# Task 2.1 eigenvalue convergence grid, one alpha per array task (sparse shift-invert, single-threaded SuperLU).
# Points are cached in results/task2_1/eig_<alpha>_<Na>_<Nb>.npz and skipped on a rerun.
ALPHAS=(0.6 0.8 1.0 1.2 1.4 1.6 1.8 2.0 2.1)
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg OMP_NUM_THREADS=1
.venv/bin/python scripts/task2_1_bit_flip.py eig ${ALPHAS[$SLURM_ARRAY_TASK_ID]}
