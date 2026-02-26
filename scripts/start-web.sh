#!/bin/bash
# ================================================================
# Web service start script — Railway
# ================================================================
set -e

# ----------------------------------------------------------------
# 0. Pre-flight: warn loudly about missing critical variables
# ----------------------------------------------------------------
MISSING=""
[ -z "$SECRET_KEY" ]    && MISSING="$MISSING\n  - SECRET_KEY"
[ -z "$DATABASE_URL" ]  && MISSING="$MISSING\n  - DATABASE_URL"

if [ -n "$MISSING" ]; then
  echo "================================================================"
  echo "WARNING: The following environment variables are NOT set:"
  printf "%b\n" "$MISSING"
  echo "Set them in Railway: service > Variables tab."
  echo "The app will try to start but may not function correctly."
  echo "================================================================"
fi

# ----------------------------------------------------------------
# 1. Enable PostGIS (non-fatal: DB plugin might not be linked yet)
# ----------------------------------------------------------------
if [ -n "$DATABASE_URL" ]; then
  echo "--- Enabling PostGIS extension ---"
  python -c "
import os, re, psycopg2, sys

db_url = os.environ.get('DATABASE_URL', '')
db_url = re.sub(r'^postgis://', 'postgresql://', db_url)
db_url = re.sub(r'^postgres://', 'postgresql://', db_url)

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute('CREATE EXTENSION IF NOT EXISTS postgis;')
    conn.close()
    print('PostGIS ready')
except Exception as e:
    print(f'WARNING: could not enable PostGIS: {e}', file=sys.stderr)
" || true
fi

# ----------------------------------------------------------------
# 2. Collect static files (always — does not need DB)
# ----------------------------------------------------------------
echo "--- Collecting static files ---"
python manage.py collectstatic --noinput --clear

# ----------------------------------------------------------------
# 3. Wait for DB and run migrations (only if DB is linked)
# ----------------------------------------------------------------
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL not set — skipping migrate."
  echo "Link the Postgres plugin to this service in Railway and redeploy."
else
  echo "--- Waiting for database ---"
  echo "    DATABASE_URL prefix: ${DATABASE_URL:0:40}..."
  python -c "
import os, re, time, psycopg2, sys

db_url = os.environ.get('DATABASE_URL', '')
db_url = re.sub(r'^postgis://', 'postgresql://', db_url)
db_url = re.sub(r'^postgres://', 'postgresql://', db_url)

for attempt in range(1, 16):
    try:
        conn = psycopg2.connect(db_url)
        conn.close()
        print(f'Database ready (attempt {attempt})')
        sys.exit(0)
    except psycopg2.OperationalError as e:
        print(f'Attempt {attempt}/15 — not ready: {e}', file=sys.stderr)
        time.sleep(4)

print('ERROR: database never became available after 60s.', file=sys.stderr)
sys.exit(1)
" || { echo "WARNING: DB wait timed out — starting anyway."; }

  echo "--- Running migrations ---"
  python manage.py migrate --noinput || echo "WARNING: migrate failed — check DB connection."
fi

echo "--- Starting gunicorn ---"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
