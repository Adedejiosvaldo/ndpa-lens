#!/usr/bin/env bash
# Start local services, wait until healthy, then make sure the bucket exists.
# (`up --wait` counts a finished one-shot container as a failure, so the bucket
# step runs separately.)
set -euo pipefail
cd "$(dirname "$0")"
docker compose up -d --wait postgres redis s3 mailpit
docker compose run --rm --quiet-pull s3-init >/dev/null
echo "Dev services ready: Postgres :5432, Redis :6379, S3 :8333, Mailpit :1025 (UI :8025)"
