#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task2_3
#SBATCH --array=0-11
#SBATCH --cpus-per-task=1
#SBATCH --mem=2gb
#SBATCH --time=1:01:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%A_%a.out
# Task 2.3 readout: one array task per (N_a, N_b, eps_Z) point of POINTS in scripts/task2_3_readout.py, both codewords
# batched, 0-4 us; cached points are skipped. Job 16159396 (one core each): 16 x 4 and 24 x 8 under 1 min, 32 x 12 3:43,
# 40 x 16 19:56, MaxRSS 0.60 GB. The 40 x 16 points at 0.05 and 0.2 g2 (tasks 9 and 11) came later with --array=9,11.
# Afterwards run the analysis on the login node: .venv/bin/python scripts/task2_3_readout.py | tee logs/task2_3_analysis.log
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg
.venv/bin/python scripts/task2_3_readout.py $SLURM_ARRAY_TASK_ID
