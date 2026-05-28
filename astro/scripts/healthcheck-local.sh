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

build_connect_args() {
  local scheme="$1"
  if [[ -z "$HEALTHCHECK_CONNECT_IP" ]]; then
    echo ""
    return 0
  fi
  if [[ "$scheme" == "https" ]]; then
    echo "--connect-to ${HEALTHCHECK_DOMAIN}:443:${HEALTHCHECK_CONNECT_IP}:443"
  else
    echo "--connect-to ${HEALTHCHECK_DOMAIN}:80:${HEALTHCHECK_CONNECT_IP}:80"
  fi
}

build_curl_args() {
  local scheme="$1"
  local args=(-sS)
  if [[ "$scheme" == "https" && "$HEALTHCHECK_INSECURE_TLS" == "1" ]]; then
    args+=(-k)
  fi
  printf '%s\n' "${args[@]}"
}

fetch_status_and_body() {
  local scheme="$1"
  local url="$2"
  local header_file
  local body_file
  local error_file
  local curl_rc
  header_file="$(mktemp)"
  body_file="$(mktemp)"
  error_file="$(mktemp)"

  local -a connect_args=()
  local connect_arg_line
  connect_arg_line="$(build_connect_args "$scheme")"
  if [[ -n "$connect_arg_line" ]]; then
    connect_args=($connect_arg_line)
  fi

  local -a curl_args=()
  while IFS= read -r line; do
    curl_args+=("$line")
  done < <(build_curl_args "$scheme")

  set +e
  curl "${curl_args[@]}" "${connect_args[@]}" -D "$header_file" -o "$body_file" "$url" 2>"$error_file"
  curl_rc=$?
  set -e
  if [[ "$curl_rc" -ne 0 ]]; then
    printf '__CURL_ERROR__\n'
    printf '%s\n' "$curl_rc"
    sed -n '1,10p' "$error_file"
    rm -f "$header_file" "$body_file" "$error_file"
    return 0
  fi

  local status
  status="$(awk 'toupper($1) ~ /^HTTP/ {code=$2} END {print code}' "$header_file")"
  local body
  body="$(<"$body_file")"
  rm -f "$header_file" "$body_file" "$error_file"

  printf '%s\n' "$status"
  printf '%s' "$body"
}

check_route() {
  local scheme="$1"
  local path="$2"
  local url="${scheme}://${HEALTHCHECK_DOMAIN}${path}"
  echo "Healthcheck: ${url}"

  local response
  response="$(fetch_status_and_body "$scheme" "$url")"
  local first_line status body
  first_line="$(printf '%s' "$response" | sed -n '1p')"

  if [[ "$first_line" == "__CURL_ERROR__" ]]; then
    local curl_rc err_text
    curl_rc="$(printf '%s' "$response" | sed -n '2p')"
    err_text="$(printf '%s' "$response" | sed '1,2d')"
    echo "Fallo curl (${curl_rc}) en ${url}: ${err_text}"
    return 11
  fi

  status="$first_line"
  body="$(printf '%s' "$response" | sed '1d')"

  if [[ "$status" != "200" && "$status" != "301" && "$status" != "302" ]]; then
    echo "Fallo: status HTTP inesperado ${status} en ${url}"
    return 12
  fi

  case "$body" in
    *"Plesk service page"*|*"The webserver is alive"*)
      echo "Fallo: Apache está sirviendo la página interna de Plesk en ${url}"
      return 13
      ;;
  esac

  return 0
}

should_fallback_to_http() {
  local message="$1"
  if [[ "$HEALTHCHECK_SCHEME" != "https" ]]; then
    return 1
  fi
  if [[ "$HEALTHCHECK_CONNECT_IP" != "127.0.0.1" && "$HEALTHCHECK_CONNECT_IP" != "::1" ]]; then
    return 1
  fi
  case "$message" in
    *"wrong version number"*) return 0 ;;
  esac
  return 1
}

run_checks_with_scheme() {
  local scheme="$1"

  if ! check_route "$scheme" "/"; then
    return 1
  fi
  if ! check_route "$scheme" "/blog/"; then
    return 1
  fi
  return 0
}

if ! run_checks_with_scheme "$HEALTHCHECK_SCHEME"; then
  last_error="$(fetch_status_and_body "$HEALTHCHECK_SCHEME" "${HEALTHCHECK_SCHEME}://${HEALTHCHECK_DOMAIN}/" | sed -n '1,5p' | tr '\n' ' ')"
  if should_fallback_to_http "$last_error"; then
    echo "Aviso: TLS local no disponible en ${HEALTHCHECK_CONNECT_IP}. Reintentando healthcheck por HTTP."
    run_checks_with_scheme "http"
  else
    exit 1
  fi
fi

echo "Healthcheck OK: despliegue visible por Apache (${HEALTHCHECK_DOMAIN})."
