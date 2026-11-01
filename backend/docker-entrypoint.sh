#!/bin/sh
set -e

# Apply database migrations, then start the API.
alembic upgrade head

# One worker keeps the in-memory rate limiter exact; nginx adds a second, global limit.
# Raise WEB_CONCURRENCY only after moving rate limiting to Redis (see DEPLOYMENT.md).
exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers "${WEB_CONCURRENCY:-1}" \
  --bind 0.0.0.0:8000 \
  --timeout 60 \
  --graceful-timeout 20 \
  --access-logfile - \
  --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}"
