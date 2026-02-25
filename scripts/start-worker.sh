#!/bin/sh
# ================================================================
# Celery worker start script — Railway
# In Railway dashboard: same Dockerfile.railway, override startCommand
# with: /app/scripts/start-worker.sh
# ================================================================
set -e

echo "--- Starting Celery worker ---"
exec celery -A config.celery worker \
  --loglevel=info \
  --concurrency="${CELERY_CONCURRENCY:-2}"
