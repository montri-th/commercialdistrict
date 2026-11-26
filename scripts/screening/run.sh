#!/bin/sh
# Neighbourhood screening, steps 1-9. Inputs: SCREEN_SRC (clones of the 16 dataset repositories at the commits in
# data/neighborhoods.json datasets[].source), optional SCREEN_REGISTRY_XLSX (a private export of the neighbourhood registry, never
# committed). Outputs go to SCREEN_WORK (default /tmp/citymeter-screening), never into this repository.
set -e
cd "$(dirname "$0")"
for s in 01_points 02_seeds 03_score 04_centres 05_groups 06_candidates 07_facts 08_logit 09_review_rows; do
  echo "== $s"
  python3 -I "$s.py"
done
