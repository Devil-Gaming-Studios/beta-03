#!/usr/bin/env bash
# Two-device sync test against a real server. Usage: bash scripts/test_sync.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PORT=3111 BASE=http://127.0.0.1:3111
T=$(mktemp -d); export SYNC_DB_FILE="$T/sync-db.json"
npx tsx server.ts >"$T/server.log" 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true; rm -rf "$T"' EXIT
for i in $(seq 1 40); do curl -sf "$BASE/api/graph/stats" >/dev/null && break; sleep 0.5; done
A="$T/A"; B="$T/B"; D="npx tsx scripts/sync_device.ts"
ok() { echo "$2" | grep -q "$3" && echo "PASS  $1" || { echo "FAIL  $1  ->  $2"; exit 1; }; }

ok "A registers and creates sync account"   "$($D $A register)"            '"ok":true'
ok "A adds stock"                           "$($D $A add ZZMustard 700)"    'added'
ok "B (fresh phone) logs in via server"     "$($D $B login)"                '"loggedIn":true'
ok "B sees A's stock"                       "$($D $B show)"                 'ZZMustard'
ok "B adds stock"                           "$($D $B add ZZCumin 300)"      'added'
ok "A pulls B's stock"                      "$($D $A sync >/dev/null; $D $A show)" 'ZZCumin'
ok "A deletes an item"                      "$($D $A remove ZZMustard)"     'removed true'
ok "delete reaches B"                       "$($D $B sync >/dev/null; $D $B show)" '"stock":\["ZZCumin"\]'
ok "wrong password is rejected"             "$(curl -s -X POST $BASE/api/sync/login -H 'content-type: application/json' -d '{"email":"asha@example.com","password":"nope123"}')" 'wrong password'
ok "no token -> 401"                        "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/sync/pull)" '401'
echo "ALL SYNC TESTS PASSED"
