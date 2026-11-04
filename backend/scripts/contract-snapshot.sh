#!/usr/bin/env bash
# Pemakaian: ./scripts/contract-snapshot.sh http://localhost:3000/api > snapshot-<label>.txt
set -u
B=${1:?base url}
TMP=$(mktemp -d)
base64 -d > "$TMP/ok.png" <<< 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
echo "bukan gambar" > "$TMP/fake.png"

shape() { jq -S 'walk(if type=="array" then .[0:1] elif type=="object" then . else type end)' 2>/dev/null || echo "(bukan JSON)"; }
call() {
  local name=$1; shift
  local meta; meta=$(curl -s -o "$TMP/body" -w '%{http_code} %{content_type}' "$@")
  echo "### $name -> $meta"
  case "$meta" in *json*) shape < "$TMP/body" ;; *) echo "(body $(wc -c < "$TMP/body") byte non-JSON)" ;; esac
}
tok() { curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .accessToken; }

ADMIN=$(tok admin@company.test 'Admin123!'); BUDI=$(tok budi@company.test 'Karyawan123!')
H_A="Authorization: Bearer $ADMIN"; H_B="Authorization: Bearer $BUDI"

call time            "$B/time"
call login-salah     -X POST "$B/auth/login" -H 'Content-Type: application/json' -d '{"email":"budi@company.test","password":"x"}'
call me              "$B/auth/me" -H "$H_B"
call employees-list  "$B/employees?page=1&limit=5" -H "$H_A"
call employees-403   "$B/employees" -H "$H_B"
call today-kosong    "$B/attendances/today" -H "$H_B"
call absen-fake      -X POST "$B/attendances" -H "$H_B" -F "photo=@$TMP/fake.png;type=image/png"
call absen-ok        -X POST "$B/attendances" -H "$H_B" -F "photo=@$TMP/ok.png" -F notes=tes
ID=$(jq -r .id < "$TMP/body")
call absen-409       -X POST "$B/attendances" -H "$H_B" -F "photo=@$TMP/ok.png"
call today           "$B/attendances/today" -H "$H_B"
call my              "$B/attendances/my?page=1&limit=5" -H "$H_B"
call hrd-list        "$B/attendances?page=1&limit=5" -H "$H_A"
call hrd-search      "$B/attendances?search=budi" -H "$H_A"
call hrd-403         "$B/attendances" -H "$H_B"
call foto-owner      "$B/attendances/$ID/photo" -H "$H_B"
call foto-admin      "$B/attendances/$ID/photo" -H "$H_A"
call foto-anon       "$B/attendances/$ID/photo"
call foto-404        "$B/attendances/00000000-0000-4000-8000-000000000000/photo" -H "$H_A"
call foto-bad-id     "$B/attendances/xyz/photo" -H "$H_B"

