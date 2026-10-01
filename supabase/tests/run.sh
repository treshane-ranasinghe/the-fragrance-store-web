#!/bin/bash
# Runs the migrations + seed + scenario tests against a local plain Postgres (15+ recommended)
# with small stubs for Supabase's auth / storage / cron / net schemas.
# Usage: PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/.."
P="psql -q -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists fs_test" >/dev/null && $P -d postgres -c "create database fs_test" >/dev/null
$P -d fs_test -f "$HERE/supabase_stub.sql" >/dev/null 2>&1
OLD_PG=$([ "$(psql -tAc 'show server_version_num' -d postgres)" -lt 150000 ] && echo 1 || echo 0)
for f in "$ROOT"/migrations/*.sql "$ROOT"/seed.sql; do
  # pg_cron / pg_net are stubbed; security_invoker needs Postgres 15+ (stripped on older versions)
  sed -e '/create extension if not exists pg_cron/d' -e '/create extension if not exists pg_net/d' "$f" \
    | { if [ "$OLD_PG" = 1 ]; then sed -e 's/ with (security_invoker = true)//'; else cat; fi; } \
    | $P -d fs_test >/dev/null 2>&1 || { echo "FAILED: $f"; exit 1; }
done
psql -q -d fs_test -f "$HERE/scenarios.sql" > /tmp/fs_scenarios.out 2>&1
if grep -q ERROR /tmp/fs_scenarios.out; then grep -B3 -A3 ERROR /tmp/fs_scenarios.out; exit 1; fi
tail -1 /tmp/fs_scenarios.out; echo "All scenarios passed"
