#!/usr/bin/env bash
# Applies supabase/migrations in order to a throwaway Postgres 16 container,
# on top of a stub of the Supabase auth schema, and runs the role scenarios.
#
#   supabase/tests/run.sh
#
# Needs Docker. Set DOCKER to the docker binary if it is not on PATH, and
# IMAGE to use another Postgres image (default postgres:16-alpine). The
# container is removed when the script exits.

set -euo pipefail

DOCKER="${DOCKER:-docker}"
IMAGE="${IMAGE:-postgres:16-alpine}"
NAME="buho-db-test-$$"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"

cleanup() {
  "$DOCKER" rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

run_psql() {
  "$DOCKER" exec -i "$NAME" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "Starting $IMAGE"
"$DOCKER" run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null

# The image's init step runs a temporary server on the socket only, so wait for
# the real one on TCP.
for _ in $(seq 1 60); do
  if "$DOCKER" exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
"$DOCKER" exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres

echo "Applying bootstrap.sql (auth stub and API roles)"
run_psql < "$HERE/bootstrap.sql"

for migration in "$MIGRATIONS"/*.sql; do
  echo "Applying $(basename "$migration")"
  run_psql < "$migration"
done

echo "Running role_scenarios.sql"
run_psql < "$HERE/role_scenarios.sql" 2>&1 | sed -e 's/^psql:<stdin>:[0-9]*: //' -e 's/^NOTICE:  //'
exit "${PIPESTATUS[0]}"
