#!/bin/sh
# ================================================================
# Celery beat start script — Railway
# In Railway dashboard: same Dockerfile.railway, override startCommand
# with: /app/scripts/start-beat.sh
# ================================================================
set -e

echo "--- Starting Celery beat ---"
exec celery -A config.celery beat \
  --loglevel=info \
  --scheduler django_celery_beat.schedulers:DatabaseScheduler
