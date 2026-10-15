#!/usr/bin/env bash
# Fresh local database: Supabase stand-in, then the real migrations, then the checks.
# Usage: PGHOST=/tmp PGPORT=54329 PGUSER=postgres DENO=deno tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=probono_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d $DB -f tests/db/access.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
${DENO:-deno} test --config tests/deno.json --allow-net --allow-env --allow-read --allow-sys --allow-write tests/db/adapter.test.ts
