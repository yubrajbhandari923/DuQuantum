#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task2_4
#SBATCH --array=0-21
#SBATCH --cpus-per-task=1
#SBATCH --mem=4gb
#SBATCH --time=0:10:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%A_%a.out
# Task 2.4: one array task per TASKS entry of scripts/task2_4_readout.py (eigenvalues per alpha, 0-4 us time runs at
# 24 x 8 or 32 x 12, the shaped turn-on); cached points are skipped. Then on the login node:
# .venv/bin/python scripts/task2_4_readout.py | tee logs/task2_4_analysis.log
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg
.venv/bin/python scripts/task2_4_readout.py $SLURM_ARRAY_TASK_ID
