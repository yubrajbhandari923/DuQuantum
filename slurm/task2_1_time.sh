#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task2_1-time
#SBATCH --array=0-7
#SBATCH --cpus-per-task=2
#SBATCH --mem=4gb
#SBATCH --time=3:00:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%A_%a.out
# Task 2.1 time-domain runs from |alpha>|0>: tasks 0-3 at the chosen truncation over T_END, tasks 4-7 the check runs
# at (N_a + 4, N_b + 2) over T_END/2. Chunks are checkpointed in results/task2_1/ and a rerun resumes.
# Speed test job 16159821 (2 cores): 0.015 s/us at 12x4, 0.06 at 16x5, 0.26 at 18x6, 1.1 at 20x8; longest task about 1.5 h.
ALPHAS=(0.8 1.0 1.2 1.4)
i=$SLURM_ARRAY_TASK_ID
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg
if [ $i -lt 4 ]; then
  .venv/bin/python scripts/task2_1_bit_flip.py time ${ALPHAS[$i]}
else
  .venv/bin/python scripts/task2_1_bit_flip.py time ${ALPHAS[$((i - 4))]} check
fi
