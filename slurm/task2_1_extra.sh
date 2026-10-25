#!/bin/bash
#SBATCH --account=bernevig
#SBATCH --job-name=duq-task2_1-extra
#SBATCH --array=0-17
#SBATCH --cpus-per-task=1
#SBATCH --mem=32gb
#SBATCH --time=3:00:00
#SBATCH --output=/scratch/gpfs/BERNEVIG/ak9089/DuQuantum/logs/%x-%A_%a.out
# Task 2.1 eigenvalue variants (nominal, 2 kappa_a, thermal n_th) for one alpha per array task, tasks 0-8 at the chosen
# truncation and 9-17 at the check truncation; cached in results/task2_1/<tag>_<alpha>_<Na>_<Nb>.npz, skipped on a rerun.
# Grid job 16159820: (28, 10) took 330-390 s and 3.6 GB; (32, 12) about 35 min and 10 GB.
ALPHAS=(0.6 0.8 1.0 1.2 1.4 1.6 1.8 2.0 2.1)
i=$SLURM_ARRAY_TASK_ID
cd /scratch/gpfs/BERNEVIG/ak9089/DuQuantum
export PYTHONUNBUFFERED=1 MPLBACKEND=Agg OMP_NUM_THREADS=1
if [ $i -lt 9 ]; then
  .venv/bin/python scripts/task2_1_bit_flip.py extra ${ALPHAS[$i]}
else
  .venv/bin/python scripts/task2_1_bit_flip.py extra ${ALPHAS[$((i - 9))]} check
fi
