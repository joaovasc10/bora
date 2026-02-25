#!/bin/sh
# ================================================================
# Web service start script — Railway
# Enables PostGIS, runs migrations, collects static, starts gunicorn
# ================================================================
set -e

echo "--- Enabling PostGIS extension ---"
python -c "
import os, re, psycopg2

db_url = os.environ.get('DATABASE_URL', '')
db_url = re.sub(r'^postgis://', 'postgresql://', db_url)

conn = psycopg2.connect(db_url)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute('CREATE EXTENSION IF NOT EXISTS postgis;')
    cur.execute('CREATE EXTENSION IF NOT EXISTS postgis_topology;')
conn.close()
print('PostGIS ready')
"

echo "--- Running migrations ---"
python manage.py migrate --noinput

echo "--- Collecting static files ---"
python manage.py collectstatic --noinput

echo "--- Starting gunicorn ---"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
