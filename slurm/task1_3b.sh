#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task1_3b
#SBATCH --array=0-33
#SBATCH --cpus-per-task=1
#SBATCH --mem=4gb
#SBATCH --time=1:01:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%A_%a.out
# Task 1.3(b): one preparation protocol per array task (POINTS in the script), 3 us each; 32 x 12 points take 1 to 1.5 min,
# the six 40 x 16 checks 5.4 to 6.8 min, MaxRSS at most 0.6 GB (jobs 16159480, 16159567, 16159696, 16164530). Then run the analysis
# on the login node.
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg
.venv/bin/python scripts/task1_3b_codeword.py run $SLURM_ARRAY_TASK_ID
