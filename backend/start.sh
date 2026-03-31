#!/usr/bin/env bash
# start.sh
# Startup script for production deployment on Render.
#
# Order:
#   1. Run Alembic migrations (idempotent — safe to re-run on every deploy).
#   2. Launch uvicorn on the port Render injects via $PORT.
#
# Notes:
#   - set -e causes the script to exit immediately if any command fails.
#     This prevents uvicorn from starting with an out-of-date schema.
#   - --workers 1 is intentional: the async SQLAlchemy engine manages its
#     own connection pool. Multiple workers would create separate pools and
#     compete for the free-tier connection limit on Supabase (max 60 direct
#     connections on the free plan). One async worker handles concurrency
#     via the event loop.
#   - $PORT is set automatically by Render. The default 8000 is a fallback
#     for local testing with this script directly.

set -e

echo "[start] Running database migrations..."
alembic upgrade head
echo "[start] Migrations applied successfully."

echo "[start] Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers 1 \
    --log-level warning
