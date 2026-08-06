#!/usr/bin/env bash
# Remote commands executed on each production GCE instance (via SSH stdin).
# See: .github/workflows/Deploy Prod.yaml
set -euo pipefail

cd /home/github
echo "----------------------------------------------------------------------------------------"
echo "----------------------- Start of Wallet Deployment Script ------------------------------"
echo "----------------------------------------------------------------------------------------"

echo "---------------------------- Docker Deployment ---------------------------------------"
docker compose pull

docker stop wallet || true
docker rm -f wallet || true

docker compose up -d

docker system prune -f
