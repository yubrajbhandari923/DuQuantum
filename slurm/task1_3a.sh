#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task1_3a
#SBATCH --array=0-3
#SBATCH --cpus-per-task=1
#SBATCH --mem=4gb
#SBATCH --time=1:01:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%A_%a.out
# Task 1.3(a): two-mode inflation from vacuum, one run per array task: 10 us at 32 x 12 and the 40 x 16 check, then the
# same to 3 us with kappa_a = 0. Jobs 16159355 and 16159543: 32 x 12 took 194 s for 10 us and 45 s for 3 us, 40 x 16
# took 1183 s and 259 s (about 6 times slower); MaxRSS at most 0.54 GB.
# Then run the analysis on the login node.
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg
SIZES=("32 12" "40 16" "32 12 3 ka0" "40 16 3 ka0")
.venv/bin/python scripts/task1_3a_cat_state.py run ${SIZES[$SLURM_ARRAY_TASK_ID]}
