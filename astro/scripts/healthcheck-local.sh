#!/usr/bin/env bash
set -euo pipefail

HEALTHCHECK_SCHEME="${HEALTHCHECK_SCHEME:-https}"
HEALTHCHECK_DOMAIN="${HEALTHCHECK_DOMAIN:-fenicio.es}"
HEALTHCHECK_CONNECT_IP="${HEALTHCHECK_CONNECT_IP:-}"
HEALTHCHECK_INSECURE_TLS="${HEALTHCHECK_INSECURE_TLS:-1}"

if [[ "$HEALTHCHECK_SCHEME" != "http" && "$HEALTHCHECK_SCHEME" != "https" ]]; then
  echo "HEALTHCHECK_SCHEME debe ser http o https"
  exit 1
fi

if [[ -n "$HEALTHCHECK_CONNECT_IP" ]]; then
  if [[ "$HEALTHCHECK_SCHEME" == "https" ]]; then
    CONNECT_ARGS=(--connect-to "${HEALTHCHECK_DOMAIN}:443:${HEALTHCHECK_CONNECT_IP}:443")
  else
    CONNECT_ARGS=(--connect-to "${HEALTHCHECK_DOMAIN}:80:${HEALTHCHECK_CONNECT_IP}:80")
  fi
else
  CONNECT_ARGS=()
fi

CURL_ARGS=(-sS)
if [[ "$HEALTHCHECK_SCHEME" == "https" && "$HEALTHCHECK_INSECURE_TLS" == "1" ]]; then
  CURL_ARGS+=(-k)
fi

fetch_status_and_body() {
  local url="$1"
  local header_file
  local body_file
  header_file="$(mktemp)"
  body_file="$(mktemp)"

  curl "${CURL_ARGS[@]}" "${CONNECT_ARGS[@]}" -D "$header_file" -o "$body_file" "$url"
  local status
  status="$(awk 'toupper($1) ~ /^HTTP/ {code=$2} END {print code}' "$header_file")"
  local body
  body="$(cat "$body_file")"
  rm -f "$header_file" "$body_file"

  printf '%s\n' "$status"
  printf '%s' "$body"
}

check_route() {
  local path="$1"
  local url="${HEALTHCHECK_SCHEME}://${HEALTHCHECK_DOMAIN}${path}"
  echo "Healthcheck: ${url}"

  local response
  response="$(fetch_status_and_body "$url")"
  local status body
  status="$(printf '%s' "$response" | sed -n '1p')"
  body="$(printf '%s' "$response" | sed '1d')"

  if [[ "$status" != "200" && "$status" != "301" && "$status" != "302" ]]; then
    echo "Fallo: status HTTP inesperado ${status} en ${url}"
    exit 1
  fi

  if printf '%s' "$body" | rg -q "Plesk service page|The webserver is alive"; then
    echo "Fallo: Apache está sirviendo la página interna de Plesk en ${url}"
    exit 1
  fi
}

check_route "/"
check_route "/blog/"

echo "Healthcheck OK: despliegue visible por Apache (${HEALTHCHECK_DOMAIN})."
